import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyWebhook } from '../lib/webhook-signatures';
import { handleApi } from '../lib/server/api';

const call = (path: string, init?: RequestInit) =>
  handleApi(new Request(`http://localhost:8000/api/bought/${path}`, init));

void test('with no keys the API says so and calls nothing', async () => {
  for (const k of Object.keys(process.env))
    if (/^(SUPABASE|MUX|UPSTASH|STRIPE|RAZORPAY|CRON)/.test(k)) delete process.env[k];
  const config = await (await call('config')).json();
  assert.equal(config.live, false);
  assert.equal(config.supabaseKey, null);
  assert.equal((await call('ads/market')).status, 503);
  assert.equal((await call('webhooks/mux', { method: 'POST', body: '{}' })).status, 503);
  const status = await (await call('admin/status')).json();
  assert.ok(status.missing.includes('MUX_TOKEN_ID'));
  assert.equal((await call('admin/queue')).status, 401);
});

void test('the config answer never contains a secret', async () => {
  process.env.MUX_TOKEN_SECRET = 'mux-secret-value';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-secret-value';
  const raw = await (await call('config')).text();
  assert.ok(!raw.includes('secret-value'));
  delete process.env.MUX_TOKEN_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

void test('webhook signatures: tampering and replay are refused', async () => {
  const raw = '{"id":"e1"}';
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const sig = createHmac('sha256', 's').update(`${t}.${raw}`).digest('hex');
  assert.equal(await verifyWebhook(raw, `t=${t},v1=${sig}`, 's', true, now), true);
  assert.equal(await verifyWebhook(raw + ' ', `t=${t},v1=${sig}`, 's', true, now), false);
  assert.equal(await verifyWebhook(raw, `t=${t},v1=${sig}`, 's', true, now + 600000), false);
  const plain = createHmac('sha256', 's').update(raw).digest('hex');
  assert.equal(await verifyWebhook(raw, plain, 's', false), true);
  assert.equal(await verifyWebhook(raw, '0'.repeat(64), 's', false), false);
});
