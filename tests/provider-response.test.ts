import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../lib/server/config';
import { providerRequest } from '../lib/server/providers';

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
