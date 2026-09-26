import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../lib/server/api';

void test('public API routes are exact, cacheable, and hardened', async () => {
  const response = await handleApi(
    new Request('https://bought.example/api/bought/config'),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /s-maxage=300/);
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /default-src 'none'/,
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

  const extraSegment = await handleApi(
    new Request('https://bought.example/api/bought/config/extra'),
  );
  assert.equal(extraSegment.status, 404);

  const unsupportedMethod = await handleApi(
    new Request('https://bought.example/api/bought/config', {
      method: 'PATCH',
    }),
  );
  assert.equal(unsupportedMethod.status, 405);
  assert.equal(unsupportedMethod.headers.get('allow'), 'GET, POST');

  const snapshot = await handleApi(
    new Request('https://bought.example/api/bought/snapshot'),
  );
  assert.equal(snapshot.status, 200);
  assert.match(snapshot.headers.get('cache-control') ?? '', /s-maxage=5/);
  const snapshotBody = (await snapshot.json()) as {
    market: { configured: boolean };
    entries: unknown[];
  };
  assert.equal(snapshotBody.market.configured, false);
  assert.deepEqual(snapshotBody.entries, []);

  const pushKey = await handleApi(
    new Request('https://bought.example/api/bought/push/key'),
  );
  assert.equal(pushKey.status, 200);
  assert.deepEqual(await pushKey.json(), { publicKey: null });
});

void test('Vercel cron GET requests require the configured bearer secret', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret';
  try {
    const response = await handleApi(
      new Request('https://bought.example/api/bought/cron'),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
