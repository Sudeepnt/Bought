export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function setting(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function required(name: string): string {
  const value = setting(name);
  if (!value)
    throw new HttpError(
      503,
      'This service is temporarily unavailable. Please try again later.',
    );
  return value;
}

const commonKeys = [
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
  'APP_ORIGIN',
  'CRON_SECRET',
];

export function configuredProviders() {
  const base = commonKeys.every((k) => !!setting(k));
  return {
    stripe:
      base &&
      ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].every((k) => !!setting(k)),
    razorpay:
      base &&
      [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
      ].every((k) => !!setting(k)),
  };
}

export function origin() {
  return new URL(required('APP_ORIGIN')).origin;
}
