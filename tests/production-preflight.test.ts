import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = new URL('../scripts/check-production-env.mjs', import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString();

const validEnvironment = {
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://bought.example',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server',
  STRIPE_SECRET_KEY: 'sk_live_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_stripe_123456789012345678901234',
  MUX_TOKEN_ID: 'mux-token-id',
  MUX_TOKEN_SECRET: 'mux-token-secret',
  MUX_WEBHOOK_SECRET: 'mux_webhook_123456789012345678901234',
  MUX_SIGNING_KEY_ID: 'mux-signing-id',
  MUX_SIGNING_PRIVATE_KEY: privateKey,
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
  CRON_SECRET: 'cron_1234567890123456789012345678',
};

function preflight(overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script.pathname], {
    encoding: 'utf8',
    env: { ...validEnvironment, ...overrides } as NodeJS.ProcessEnv,
  });
}

void test('production preflight accepts a complete isolated environment', () => {
  const result = preflight();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Enabled checkout: Stripe/);
});

void test('Vercel production builds fail closed through the credential preflight', () => {
  assert.match(
    packageJson.scripts.build,
    /VERCEL_ENV.*production.*preflight:production/,
  );
});

void test('production preflight rejects key exposure and malformed origins', () => {
  const result = preflight({
    APP_ORIGIN: 'https://user:password@bought.example/admin?token=secret',
    SUPABASE_PUBLISHABLE_KEY: 'sb_secret_exposed',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_exposed',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /APP_ORIGIN must be a production HTTPS URL/);
  assert.match(result.stderr, /server and browser keys must be different/);
  assert.match(result.stderr, /PUBLISHABLE_KEY cannot use a secret key/);
});

void test('production preflight rejects invalid or reused signing secrets', () => {
  const repeated = 'same_secret_123456789012345678901234';
  const result = preflight({
    CRON_SECRET: repeated,
    MUX_WEBHOOK_SECRET: repeated,
    MUX_SIGNING_PRIVATE_KEY: 'not-a-private-key',
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /MUX_SIGNING_PRIVATE_KEY is not a valid private key/,
  );
  assert.match(
    result.stderr,
    /CRON_SECRET and MUX_WEBHOOK_SECRET must be different/,
  );
});

void test('production preflight rejects test-mode payment credentials', () => {
  const stripe = preflight({ STRIPE_SECRET_KEY: 'sk_test_example' });
  assert.equal(stripe.status, 1);
  assert.match(stripe.stderr, /must be a live-mode key/);

  const razorpay = preflight({
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    RAZORPAY_KEY_ID: 'rzp_test_example',
    RAZORPAY_KEY_SECRET: 'razorpay-secret',
    RAZORPAY_WEBHOOK_SECRET: 'razorpay_123456789012345678901234',
  });
  assert.equal(razorpay.status, 1);
  assert.match(razorpay.stderr, /RAZORPAY_KEY_ID must be a live-mode key/);
});
