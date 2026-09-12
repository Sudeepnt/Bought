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

function requireHttps(name, { allowLocal = false } = {}) {
  if (!value(name)) return;
  try {
    const url = new URL(value(name));
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' || (!allowLocal && local)) {
      errors.push(`${name} must be a production HTTPS URL.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

requireHttps('APP_ORIGIN');
requireHttps('SUPABASE_URL');
requireHttps('UPSTASH_REDIS_REST_URL');

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

if (
  value('MUX_SIGNING_PRIVATE_KEY').length > 0 &&
  value('MUX_SIGNING_PRIVATE_KEY').length < 200
) {
  errors.push(
    'MUX_SIGNING_PRIVATE_KEY does not look like a complete signing key.',
  );
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
