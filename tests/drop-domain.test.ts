import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hmac, verifyWebhook } from '../lib/webhook-signatures';
import {
  captureModeForCategory,
  parseBid,
  thumbnailMetadata,
  thumbnailMime,
  validMedia,
  validUuid,
} from '../lib/drop-domain';

void test('categories select the correct recording surface', () => {
  for (const category of [
    'BEEF',
    'CHAOS',
    'UNPOPULAR OPINION',
    'I WAS WRONG',
    'THE RANT',
    'CONFESSIONS',
  ])
    assert.equal(captureModeForCategory(category), 'camera');

  for (const category of [
    'MONEY I SET ON FIRE',
    'THE PITCH THAT GOT REJECTED',
    'BUILDING',
    'THE ASK',
    'HIRING',
    'AGENCY ROW',
    'INDIAN D2C',
  ])
    assert.equal(captureModeForCategory(category), 'screen');
});

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
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  png.set([73, 72, 68, 82], 12);
  png.set([0, 0, 2, 128, 0, 0, 1, 224], 16);
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  webp.set([127, 2, 0, 223, 1, 0], 24);
  assert.equal(thumbnailMime(jpeg), 'image/jpeg');
  assert.deepEqual(thumbnailMetadata(png), {
    mime: 'image/png',
    width: 640,
    height: 480,
  });
  assert.deepEqual(thumbnailMetadata(webp), {
    mime: 'image/webp',
    width: 640,
    height: 480,
  });
  assert.equal(
    thumbnailMime(new TextEncoder().encode('<svg onload=alert(1)>')),
    null,
  );
  assert.equal(thumbnailMime(new Uint8Array([255, 216, 255, 224])), null);
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
