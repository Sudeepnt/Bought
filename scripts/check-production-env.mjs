import { createPrivateKey } from 'node:crypto';

const requiredCore = [
  'APP_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
  'MUX_WEBHOOK_SECRET',
  'MUX_SIGNING_KEY_ID',
  'MUX_SIGNING_PRIVATE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'CRON_SECRET',
  'OPENAI_API_KEY',
];

const providers = {
  Stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  Razorpay: [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
  ],
};

const value = (name) => process.env[name]?.trim() ?? '';
const errors = [];

for (const name of requiredCore) {
  if (!value(name)) errors.push(`${name} is missing.`);
}

const configuredProviders = Object.entries(providers).filter(([, names]) =>
  names.every((name) => value(name)),
);
if (configuredProviders.length === 0) {
  errors.push('Configure every variable for Stripe or Razorpay.');
}
for (const [provider, names] of Object.entries(providers)) {
  const configured = names.filter((name) => value(name));
  if (configured.length > 0 && configured.length < names.length) {
    const missing = names.filter((name) => !value(name)).join(', ');
    errors.push(`${provider} is partially configured; missing ${missing}.`);
  }
}

function requireHttps(name, { allowLocal = false, originOnly = false } = {}) {
  if (!value(name)) return;
  try {
    const url = new URL(value(name));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (!allowLocal && local) ||
      (originOnly &&
        (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0))
    ) {
      errors.push(`${name} must be a production HTTPS URL.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

requireHttps('APP_ORIGIN', { originOnly: true });
requireHttps('SUPABASE_URL');
requireHttps('UPSTASH_REDIS_REST_URL');

if (
  value('SUPABASE_SERVICE_ROLE_KEY') &&
  value('SUPABASE_SERVICE_ROLE_KEY') === value('SUPABASE_PUBLISHABLE_KEY')
) {
  errors.push('Supabase server and browser keys must be different.');
}
if (value('SUPABASE_SERVICE_ROLE_KEY').startsWith('sb_publishable_')) {
  errors.push('SUPABASE_SERVICE_ROLE_KEY cannot use a publishable key.');
}
if (value('SUPABASE_PUBLISHABLE_KEY').startsWith('sb_secret_')) {
  errors.push('SUPABASE_PUBLISHABLE_KEY cannot use a secret key.');
}
if (value('OPENAI_API_KEY') && !value('OPENAI_API_KEY').startsWith('sk-')) {
  errors.push('OPENAI_API_KEY must be a server-side OpenAI API key.');
}
if (
  providers.Stripe.every((name) => value(name)) &&
  !value('STRIPE_SECRET_KEY').startsWith('sk_live_')
) {
  errors.push('STRIPE_SECRET_KEY must be a live-mode key for production.');
}
if (
  providers.Razorpay.every((name) => value(name)) &&
  !value('RAZORPAY_KEY_ID').startsWith('rzp_live_')
) {
  errors.push('RAZORPAY_KEY_ID must be a live-mode key for production.');
}

function legacyJwtRole(name) {
  const token = value(name);
  if (token.split('.').length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    errors.push(`${name} is not a valid Supabase key.`);
    return null;
  }
}

const serviceRole = legacyJwtRole('SUPABASE_SERVICE_ROLE_KEY');
if (serviceRole && serviceRole !== 'service_role') {
  errors.push('SUPABASE_SERVICE_ROLE_KEY must carry the service_role claim.');
}
const publishableRole = legacyJwtRole('SUPABASE_PUBLISHABLE_KEY');
if (publishableRole && publishableRole !== 'anon') {
  errors.push('SUPABASE_PUBLISHABLE_KEY must carry the anon claim.');
}

for (const name of [
  'CRON_SECRET',
  'STRIPE_WEBHOOK_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MUX_WEBHOOK_SECRET',
]) {
  if (value(name) && value(name).length < 24) {
    errors.push(`${name} is too short for production.`);
  }
}

if (value('MUX_SIGNING_PRIVATE_KEY')) {
  try {
    const configured = value('MUX_SIGNING_PRIVATE_KEY').replace(/\\n/g, '\n');
    createPrivateKey(
      configured.includes('BEGIN')
        ? configured
        : Buffer.from(configured, 'base64').toString('utf8'),
    );
  } catch {
    errors.push('MUX_SIGNING_PRIVATE_KEY is not a valid private key.');
  }
}

const secrets = [
  'CRON_SECRET',
  'STRIPE_WEBHOOK_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MUX_WEBHOOK_SECRET',
]
  .map((name) => [name, value(name)])
  .filter(([, secret]) => secret);
for (let i = 0; i < secrets.length; i += 1) {
  for (let j = i + 1; j < secrets.length; j += 1) {
    if (secrets[i][1] === secrets[j][1]) {
      errors.push(`${secrets[i][0]} and ${secrets[j][0]} must be different.`);
    }
  }
}

if (errors.length > 0) {
  console.error('Production environment is not ready:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Production environment is ready. Enabled checkout: ${configuredProviders
      .map(([provider]) => provider)
      .join(', ')}.`,
  );
}
