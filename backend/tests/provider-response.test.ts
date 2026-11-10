import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../lib/server/config';
import {
  createCheckout,
  providerRequest,
  trustedStripeCheckoutUrl,
  validProviderReference,
  type Topup,
} from '../lib/server/providers';
import {
  deleteVideo,
  judgeProbe,
  newVideoKey,
  NOT_PLAYABLE,
  presign,
  signUrl,
  storedType,
  validVideoKey,
} from '../lib/server/r2';

const paymentEnv = [
  'APP_ORIGIN',
  'STRIPE_SECRET_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
] as const;

async function withPaymentEnv(run: () => Promise<void>) {
  const original = new Map(
    paymentEnv.map((name) => [name, process.env[name]] as const),
  );
  process.env.APP_ORIGIN = 'https://bought.example';
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_checkout';
  process.env.RAZORPAY_KEY_SECRET = 'razorpay_test_secret';
  try {
    await run();
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function checkoutDrop(overrides: Partial<Topup> = {}): Topup {
  const usd = overrides.provider !== 'razorpay';
  return {
    id: '20000000-0000-4000-8000-000000000001',
    provider: 'stripe',
    credit_minor: 50_000,
    charge_minor: usd ? 50_000 : 4_250_000,
    charge_currency: usd ? 'USD' : 'INR',
    checkout_state: 'creating',
    ...overrides,
  };
}

void test('provider responses must be bounded valid JSON', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('not-json');
    await assert.rejects(
      providerRequest('https://provider.example', {}),
      (error: unknown) => error instanceof HttpError && error.status === 502,
    );

    globalThis.fetch = async () =>
      new Response(new Uint8Array(2 * 1024 * 1024 + 1));
    await assert.rejects(
      providerRequest('https://provider.example', {}),
      (error: unknown) => error instanceof HttpError && error.status === 502,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('provider identifiers and browser destinations are constrained', () => {
  assert.equal(validProviderReference('order_A1b2_c3-4'), true);
  assert.equal(validProviderReference(''), false);
  assert.equal(validProviderReference('../order'), false);

  assert.equal(
    trustedStripeCheckoutUrl('https://checkout.stripe.com/c/pay/test'),
    true,
  );
  assert.equal(
    trustedStripeCheckoutUrl('https://checkout.stripe.com.evil.test/pay'),
    false,
  );
  assert.equal(
    trustedStripeCheckoutUrl('https://user@checkout.stripe.com/pay'),
    false,
  );
});

void test('the R2 signer matches AWS\'s published presigned-URL example', () => {
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  const url = signUrl({
    method: 'GET',
    host: 'examplebucket.s3.amazonaws.com',
    path: '/test.txt',
    region: 'us-east-1',
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    seconds: 86400,
    now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.equal(
    new URL(url).searchParams.get('X-Amz-Signature'),
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  );
});

const r2Env = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'ak', R2_SECRET_ACCESS_KEY: 'secret-value-never-in-a-link', R2_BUCKET: 'bucket' };
async function withR2Env(run: () => Promise<void> | void) {
  const saved = Object.fromEntries(Object.keys(r2Env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, r2Env);
  try {
    await run();
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

void test('ad video links: one object, one method, short-lived, and the secret never in them', async () => {
  await withR2Env(async () => {
    const ad = '6f1c7d3e-2b4a-4c8d-9e0f-1a2b3c4d5e6f';
    const key = newVideoKey(ad, 'mp4');
    assert.ok(validVideoKey(key));
    const put = new URL(presign('PUT', key, 7200, { 'content-type': 'video/mp4' }));
    assert.equal(put.host, `${'a'.repeat(32)}.r2.cloudflarestorage.com`);
    assert.equal(put.pathname, `/bucket/${key}`);
    assert.equal(put.searchParams.get('X-Amz-Expires'), '7200');
    assert.equal(put.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
    assert.ok(!put.href.includes('secret-value'));
    assert.equal(new URL(presign('GET', key, 600)).searchParams.get('X-Amz-SignedHeaders'), 'host');
    // nothing outside ads/<ad>/<take>.mp4|webm can ever be signed
    for (const bad of ['issues/2026-11-05/media/x.mp4', `ads/${ad}/../x.mp4`, `ads/${ad}/x.html`, '', 'ads/x/y.mp4'])
      assert.throws(() => presign('GET', bad, 600));
    let method = '';
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (_input, init) => {
        method = init?.method ?? '';
        return new Response(null, { status: 204 });
      };
      await deleteVideo(key);
      assert.equal(method, 'DELETE');
      await assert.rejects(() => deleteVideo('../asset'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

void test('only browser-playable video types can be uploaded; a .mov is stored as MP4', () => {
  assert.deepEqual(storedType('video/mp4;codecs=avc1.42E01E,mp4a.40.2'), { ext: 'mp4', type: 'video/mp4' });
  assert.deepEqual(storedType('video/quicktime'), { ext: 'mp4', type: 'video/mp4' });
  assert.deepEqual(storedType('video/webm;codecs=vp9,opus'), { ext: 'webm', type: 'video/webm' });
  for (const bad of ['text/html', 'image/svg+xml', 'application/octet-stream', '', null, 42]) assert.equal(storedType(bad), null);
});

void test('the file check: picture, sound, size and length, in codecs every browser plays', () => {
  const good = { format: { duration: '30.5' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1280, height: 720 }, { codec_type: 'audio', codec_name: 'aac' }] };
  assert.equal(judgeProbe(good, 1000), null);
  // a browser recording may carry no duration; the page limits those takes itself
  assert.equal(judgeProbe({ ...good, format: {} }, 1000), null);
  assert.equal(judgeProbe(null, 1000), NOT_PLAYABLE);
  assert.equal(judgeProbe({ ...good, streams: [good.streams[0]] }, 1000), NOT_PLAYABLE, 'no sound');
  assert.equal(judgeProbe({ ...good, streams: [good.streams[1]] }, 1000), NOT_PLAYABLE, 'no picture');
  assert.equal(judgeProbe({ ...good, streams: [{ ...good.streams[0], codec_name: 'hevc' }, good.streams[1]] }, 1000), NOT_PLAYABLE, 'not every browser plays HEVC');
  assert.equal(judgeProbe({ ...good, streams: [{ ...good.streams[0], width: 200 }, good.streams[1]] }, 1000), NOT_PLAYABLE, 'too small');
  assert.equal(judgeProbe({ ...good, format: { duration: '601.5' } }, 1000), NOT_PLAYABLE, 'over 10 minutes');
  assert.equal(judgeProbe({ ...good, format: { duration: '0.4' } }, 1000), NOT_PLAYABLE, 'under a second');
  assert.match(judgeProbe(good, 501 * 1024 * 1024) ?? '', /500 MB/);
  assert.match(judgeProbe(good, 0) ?? '', /500 MB/);
});

void test('Stripe checkout retries use one stable idempotency key and validate the session', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = globalThis.fetch;
    const keys: string[] = [];
    const drop = checkoutDrop();
    try {
      globalThis.fetch = async (_input, init) => {
        keys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
        return Response.json({
          id: 'cs_test_checkout',
          url: 'https://checkout.stripe.com/c/pay/test-session',
          client_reference_id: drop.id,
          amount_total: drop.charge_minor,
          currency: 'usd',
        });
      };
      assert.deepEqual(await createCheckout(drop), {
        reference: 'cs_test_checkout',
        url: 'https://checkout.stripe.com/c/pay/test-session',
      });
      await createCheckout(drop);
      assert.deepEqual(keys, [`bought:${drop.id}`, `bought:${drop.id}`]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

void test('Stripe checkout fails closed on mismatched provider totals', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = globalThis.fetch;
    const drop = checkoutDrop();
    try {
      globalThis.fetch = async () =>
        Response.json({
          id: 'cs_test_checkout',
          url: 'https://checkout.stripe.com/c/pay/test-session',
          client_reference_id: drop.id,
          amount_total: drop.charge_minor + 1,
          currency: 'usd',
        });
      await assert.rejects(
        createCheckout(drop),
        (error: unknown) => error instanceof HttpError && error.status === 502,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

void test('Razorpay reconciliation reuses an exact existing receipt without creating another order', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = globalThis.fetch;
    const requests: { url: string; method: string }[] = [];
    const drop = checkoutDrop({ provider: 'razorpay' });
    try {
      globalThis.fetch = async (input, init) => {
        requests.push({
          url:
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          method: init?.method ?? 'GET',
        });
        return Response.json({
          items: [
            {
              id: 'order_existing',
              amount: drop.charge_minor,
              currency: 'INR',
              receipt: drop.id,
              status: 'created',
            },
          ],
        });
      };
      assert.deepEqual(await createCheckout(drop), {
        reference: 'order_existing',
        url: null,
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0].method, 'GET');
      assert.match(requests[0].url, /\/v1\/orders\?receipt=/);
      assert.match(requests[0].url, /count=2/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

void test('Razorpay reconciliation creates only after an empty receipt lookup', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = globalThis.fetch;
    const methods: string[] = [];
    const drop = checkoutDrop({ provider: 'razorpay' });
    try {
      globalThis.fetch = async (_input, init) => {
        const method = init?.method ?? 'GET';
        methods.push(method);
        if (method === 'GET') return Response.json({ items: [] });
        const body = init?.body;
        if (typeof body !== 'string') throw new Error('Expected JSON body.');
        assert.deepEqual(JSON.parse(body), {
          amount: drop.charge_minor,
          currency: 'INR',
          receipt: drop.id,
          notes: { topupId: drop.id },
          partial_payment: false,
        });
        return Response.json({
          id: 'order_created',
          amount: drop.charge_minor,
          currency: 'INR',
          receipt: drop.id,
          status: 'created',
        });
      };
      assert.deepEqual(await createCheckout(drop), {
        reference: 'order_created',
        url: null,
      });
      assert.deepEqual(methods, ['GET', 'POST']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

void test('Razorpay reconciliation fails closed on conflicting receipt data', async () => {
  await withPaymentEnv(async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    const drop = checkoutDrop({ provider: 'razorpay' });
    try {
      globalThis.fetch = async () => {
        requests += 1;
        return Response.json({
          items: [
            {
              id: 'order_conflict',
              amount: drop.charge_minor + 1,
              currency: 'INR',
              receipt: drop.id,
              status: 'created',
            },
          ],
        });
      };
      await assert.rejects(
        createCheckout(drop),
        (error: unknown) => error instanceof HttpError && error.status === 502,
      );
      assert.equal(requests, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
