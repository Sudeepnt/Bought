import assert from 'node:assert/strict';
import test from 'node:test';
import type { Drop } from '../lib/drop-domain';
import { HttpError } from '../lib/server/config';
import {
  createCheckout,
  providerRequest,
  trustedStripeCheckoutUrl,
  validMuxUploadTarget,
  validProviderReference,
} from '../lib/server/providers';

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

function checkoutDrop(overrides: Partial<Drop> = {}): Drop {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    category: 'BUILDING',
    capture_mode: 'screen',
    title: 'Production checkout',
    amount_minor: 50_000,
    currency: 'USD',
    provider: 'stripe',
    payment_state: 'unpaid',
    checkout_state: 'creating',
    payment_reference: null,
    checkout_url: null,
    paid_at: null,
    state: 'draft',
    mux_upload_id: null,
    mux_asset_id: null,
    mux_playback_id: null,
    media_state: 'none',
    thumbnail_path: null,
    thumbnail_verified: false,
    submitted_at: null,
    review_reason: null,
    auction_id: null,
    exposure_starts_at: null,
    exposure_ends_at: null,
    transcription_status: 'pending',
    transcript_english: null,
    editorial_summary: null,
    editorial_headline: null,
    editorial_quote: null,
    editorial_keywords: [],
    transcription_error: null,
    transcribed_at: null,
    created_at: '2026-09-13T00:00:00.000Z',
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

  assert.equal(
    validMuxUploadTarget(
      'upload_123',
      'https://storage.googleapis.com/video-upload/object?token=signed',
    ),
    true,
  );
  assert.equal(
    validMuxUploadTarget(
      'upload_123',
      'https://upload.mux.com/direct-upload/path',
    ),
    true,
  );
  assert.equal(
    validMuxUploadTarget('upload_123', 'https://mux.com.evil.test/upload'),
    false,
  );
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
          amount_total: drop.amount_minor,
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
          amount_total: drop.amount_minor + 1,
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
              amount: drop.amount_minor,
              currency: 'USD',
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
          amount: drop.amount_minor,
          currency: 'USD',
          receipt: drop.id,
          notes: { dropId: drop.id },
          partial_payment: false,
        });
        return Response.json({
          id: 'order_created',
          amount: drop.amount_minor,
          currency: 'USD',
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
              amount: drop.amount_minor + 1,
              currency: 'USD',
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
