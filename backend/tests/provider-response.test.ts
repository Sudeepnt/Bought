import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../lib/server/config';
import { configuredProviders } from '../lib/server/config';
import {
  chooseProvider,
  createCheckout,
  providerRequest,
  stripeSession,
  trustedStripeCheckoutUrl,
  validProviderReference,
  type Topup,
} from '../lib/server/providers';
import {
  deleteVideo,
  getObject,
  imageKey,
  judgeProbe,
  putObject,
  validImageKey,
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

void test('one payment provider takes every top-up; with none, nothing is sold', () => {
  const both = { stripe: true, razorpay: true }, stripe = { stripe: true, razorpay: false }, upi = { stripe: false, razorpay: true }, none = { stripe: false, razorpay: false };
  assert.deepEqual(chooseProvider('card', both), { provider: 'stripe', method: 'card' });
  assert.deepEqual(chooseProvider('upi', both), { provider: 'razorpay', method: 'upi' });
  assert.deepEqual(chooseProvider('upi', stripe), { provider: 'stripe', method: 'card' }, 'only Stripe: UPI buyers pay by card');
  assert.deepEqual(chooseProvider('card', upi), { provider: 'razorpay', method: 'upi' });
  assert.equal(chooseProvider('card', none), null);
  assert.equal(chooseProvider(undefined, none), null);
});

void test('Stripe is connected with its secret key alone; the webhook secret is optional', () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'APP_ORIGIN', 'CRON_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    for (const k of keys.slice(0, 11)) process.env[k] = k === 'APP_ORIGIN' ? 'https://bought.test' : 'x';
    assert.deepEqual(configuredProviders(), { stripe: false, razorpay: false });
    process.env.STRIPE_SECRET_KEY = 'sk_test_only';
    assert.deepEqual(configuredProviders(), { stripe: true, razorpay: false });
    delete process.env.SUPABASE_URL;
    assert.equal(configuredProviders().stripe, false, 'no payments until the ads backend itself is connected');
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

void test('a Checkout Session is read with the secret key, and only a well-formed session id is ever asked for', async () => {
  const originalFetch = globalThis.fetch, original = process.env.STRIPE_SECRET_KEY;
  let seen: { url: string; auth: string | null } | null = null;
  try {
    process.env.STRIPE_SECRET_KEY = 'sk_test_reader';
    globalThis.fetch = async (input, init) => {
      seen = { url: String(input), auth: new Headers(init?.headers).get('authorization') };
      return Response.json({ id: 'cs_test_1', payment_status: 'paid', amount_total: 1000, currency: 'usd' });
    };
    const session = await stripeSession('cs_test_1');
    assert.equal(session.payment_status, 'paid');
    assert.deepEqual(seen, { url: 'https://api.stripe.com/v1/checkout/sessions/cs_test_1', auth: 'Bearer sk_test_reader' });
    for (const bad of ['../charges', 'cs_1/../../x', '', 'a'.repeat(300)]) await assert.rejects(() => stripeSession(bad));
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = original;
  }
});

void test('ad pictures live in R2 under ad-images/<user>/<ad>/; nothing else can be signed', async () => {
  await withR2Env(async () => {
    const user = '0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9', ad = '6f1c7d3e-2b4a-4c8d-9e0f-1a2b3c4d5e6f', take = '11111111-2222-4333-8444-555555555555';
    assert.ok(validImageKey(imageKey(`${user}/${ad}/image-staging`)));
    assert.ok(validImageKey(imageKey(`${user}/${ad}/verified-${take}.webp`)));
    for (const bad of [`ad-images/${user}/${ad}/x.html`, `ad-images/${user}/../${ad}/image-staging`, `ad-images/${user}/${ad}/verified-${take}.svg`, 'ad-images/a/b/image-staging', `images/${user}/${ad}/image-staging`])
      assert.throws(() => presign('PUT', bad, 60));
    // the upload link is locked to the picture's type and exact size
    const put = new URL(presign('PUT', imageKey(`${user}/${ad}/image-staging`), 600, { 'content-type': 'image/webp', 'content-length': '12345' }));
    assert.equal(put.pathname, `/bucket/ad-images/${user}/${ad}/image-staging`);
    assert.equal(put.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  });
});

void test('the server reads an uploaded picture only up to 10 MB, and saves its checked copy as private and immutable', async () => {
  await withR2Env(async () => {
    const key = imageKey('0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9/6f1c7d3e-2b4a-4c8d-9e0f-1a2b3c4d5e6f/image-staging');
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response(new Uint8Array(10), { headers: { 'content-length': '10' } });
      assert.equal((await getObject(key, 100))?.length, 10);
      globalThis.fetch = async () => new Response(new Uint8Array(200), { headers: { 'content-length': '200' } });
      assert.equal(await getObject(key, 100), null, 'declared too big');
      globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(80)); c.enqueue(new Uint8Array(80)); c.close(); } }));
      assert.equal(await getObject(key, 100), null, 'too big while streaming, whatever it declared');
      globalThis.fetch = async () => new Response(null, { status: 404 });
      assert.equal(await getObject(key, 100), null);
      let seen: { url: string; headers: Headers } | null = null;
      globalThis.fetch = async (input, init) => { seen = { url: String(input), headers: new Headers(init?.headers) }; return new Response(null, { status: 200 }); };
      await putObject(imageKey('0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9/6f1c7d3e-2b4a-4c8d-9e0f-1a2b3c4d5e6f/verified-11111111-2222-4333-8444-555555555555.jpg'), new Uint8Array(42), 'image/jpeg');
      const signed = new URL(seen!.url).searchParams.get('X-Amz-SignedHeaders');
      assert.equal(signed, 'cache-control;content-length;content-type;host');
      assert.equal(seen!.headers.get('cache-control'), 'private, max-age=31536000, immutable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
