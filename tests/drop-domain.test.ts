import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hmac, verifyWebhook } from '../lib/webhook-signatures';
import {
  parseBid,
  thumbnailMime,
  validMedia,
  validUuid,
} from '../lib/drop-domain';

void test('bids use bounded integer minor units', () => {
  assert.equal(parseBid('11500'), 1150000);
  for (const value of [
    '99',
    '1000001',
    '1e4',
    '500.01',
    '-500',
    'NaN',
    ' 500',
    '999999999999',
  ])
    assert.throws(() => parseBid(value));
  assert.equal(parseBid('100'), 10000);
  assert.equal(parseBid('1000000'), 100000000);
});

void test('signed timestamped webhooks reject tampering, replay, future times, and malformed timestamps', async () => {
  const raw = '{"dropId":"paid"}',
    secret = 'test-webhook-secret',
    timestamp = 1800000000;
  const signature = await hmac(secret, `${timestamp}.${raw}`);
  assert.equal(
    await verifyWebhook(
      raw,
      `t=${timestamp},v1=${signature}`,
      secret,
      true,
      timestamp * 1000,
    ),
    true,
  );
  assert.equal(
    await verifyWebhook(
      raw,
      `t=${timestamp},v1=bad,v1=${signature}`,
      secret,
      true,
      timestamp * 1000,
    ),
    true,
  );
  assert.equal(
    await verifyWebhook(
      raw + ' ',
      `t=${timestamp},v1=${signature}`,
      secret,
      true,
      timestamp * 1000,
    ),
    false,
  );
  assert.equal(
    await verifyWebhook(
      raw,
      `t=${timestamp},v1=${signature}`,
      secret,
      true,
      (timestamp + 301) * 1000,
    ),
    false,
  );
  assert.equal(
    await verifyWebhook(
      raw,
      `t=${timestamp},v1=${signature}`,
      secret,
      true,
      (timestamp - 301) * 1000,
    ),
    false,
  );
  assert.equal(
    await verifyWebhook(
      raw,
      `t=${timestamp},t=${timestamp},v1=${signature}`,
      secret,
      true,
      timestamp * 1000,
    ),
    false,
  );
  assert.equal(await verifyWebhook(raw, null, secret, true), false);
});

void test('Razorpay verifies the exact raw body, independently of client checkout callbacks', async () => {
  const raw = '{"event":"payment.captured"}';
  const signature = await hmac('secret', raw);
  assert.equal(await verifyWebhook(raw, signature, 'secret', false), true);
  assert.equal(
    await verifyWebhook(raw, signature, 'wrong-secret', false),
    false,
  );
  assert.equal(
    await verifyWebhook(raw + '\n', signature, 'secret', false),
    false,
  );
});

void test('only genuine supported image signatures are accepted', () => {
  assert.equal(
    thumbnailMime(new Uint8Array([255, 216, 255, 224])),
    'image/jpeg',
  );
  assert.equal(
    thumbnailMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/png',
  );
  assert.equal(
    thumbnailMime(new TextEncoder().encode('<svg onload=alert(1)>')),
    null,
  );
  assert.equal(thumbnailMime(new Uint8Array()), null);
});

void test('media checks require a short video and audio track', () => {
  const tracks = [
    { type: 'video', max_width: 1280, max_height: 720 },
    { type: 'audio' },
  ];
  assert.equal(validMedia({ duration: 60, tracks }), true);
  for (const duration of [0, 122, Infinity, NaN])
    assert.equal(validMedia({ duration, tracks }), false);
  assert.equal(validMedia({ duration: 60, tracks: [tracks[0]] }), false);
  assert.equal(validMedia({ duration: 60, tracks: [tracks[1]] }), false);
  assert.equal(
    validMedia({
      duration: 60,
      tracks: [{ type: 'video', max_width: 100, max_height: 100 }, tracks[1]],
    }),
    false,
  );
  assert.equal(validUuid('not-a-drop'), false);
});
