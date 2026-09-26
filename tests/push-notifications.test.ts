import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { isTrustedPushEndpoint } from '../lib/server/push-notifications';

function decode(value: string) {
  return Buffer.from(value, 'base64url');
}

void test('push subscriptions only accept known browser push services over HTTPS', () => {
  assert.equal(isTrustedPushEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(
    isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'),
    true,
  );
  assert.equal(
    isTrustedPushEndpoint('https://storage.googleapis.com/private-object'),
    false,
  );
  assert.equal(
    isTrustedPushEndpoint('https://updates.push.services.mozilla.com/abc'),
    true,
  );
  assert.equal(isTrustedPushEndpoint('http://web.push.apple.com/abc'), false);
  assert.equal(isTrustedPushEndpoint('https://127.0.0.1/internal'), false);
  assert.equal(
    isTrustedPushEndpoint('https://web.push.apple.com.attacker.example/abc'),
    false,
  );
  assert.equal(
    isTrustedPushEndpoint('https://user@web.push.apple.com/abc'),
    false,
  );
});

void test('server creates Apple-compatible encrypted Web Push requests', async () => {
  const vapidPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const vapidJwk = await crypto.subtle.exportKey('jwk', vapidPair.privateKey);
  const vapidPublicJwk = await crypto.subtle.exportKey(
    'jwk',
    vapidPair.publicKey,
  );
  const clientPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const clientPublicKey = Buffer.from(
    await crypto.subtle.exportKey('raw', clientPair.publicKey),
  ).toString('base64url');
  const authSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    'base64url',
  );
  const vapidPublicKey = Buffer.concat([
    Buffer.from([4]),
    decode(vapidPublicJwk.x!),
    decode(vapidPublicJwk.y!),
  ]).toString('base64url');

  const request = await buildPushPayload(
    {
      data: { title: 'A new bidder took #1', body: 'Your bid was outbid.' },
      options: { ttl: 300, urgency: 'high' },
    },
    {
      endpoint: 'https://web.push.apple.com/test-endpoint',
      expirationTime: null,
      keys: { p256dh: clientPublicKey, auth: authSecret },
    },
    {
      subject: 'https://bought.example',
      publicKey: vapidPublicKey,
      privateKey: vapidJwk.d!,
    },
  );

  assert.equal(request.method, 'post');
  assert.equal(request.headers['content-encoding'], 'aes128gcm');
  assert.equal(request.headers['content-type'], 'application/octet-stream');
  assert.match(request.headers.authorization, /^vapid t=/);
  assert.equal(request.headers.ttl, '300');
  assert.equal(request.headers.urgency, 'high');
  assert.ok(request.body.byteLength > 0);
});
