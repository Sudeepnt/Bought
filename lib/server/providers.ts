import { createPrivateKey, sign } from 'node:crypto';
import type { Drop } from '../drop-domain';
import { HttpError, origin, required } from './config';

export async function providerRequest<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      'The provider could not complete this request. Your broadcast is saved.',
    );
  return response.json() as Promise<T>;
}

export async function createCheckout(drop: Drop) {
  if (drop.provider === 'stripe') {
    const params = new URLSearchParams({
      mode: 'payment',
      client_reference_id: drop.id,
      'metadata[dropId]': drop.id,
      'payment_intent_data[metadata][dropId]': drop.id,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(drop.amount_minor),
      'line_items[0][price_data][product_data][name]': `BOUGHT · ${drop.category}`,
      'line_items[0][quantity]': '1',
      success_url: `${origin()}/broadcast?dropId=${drop.id}&payment=return`,
      cancel_url: `${origin()}/broadcast?dropId=${drop.id}`,
    });
    const session = await providerRequest<{ id: string; url: string }>(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}`,
          'Idempotency-Key': `bought:${drop.id}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );
    return { reference: session.id, url: session.url };
  }
  const order = await providerRequest<{ id: string }>(
    'https://api.razorpay.com/v1/orders',
    {
      method: 'POST',
      headers: {
        Authorization: basic('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: drop.amount_minor,
        currency: 'USD',
        receipt: drop.id,
        notes: { dropId: drop.id },
        partial_payment: false,
      }),
    },
  );
  return { reference: order.id, url: null };
}

export function basic(idKey: string, secretKey: string) {
  return `Basic ${btoa(`${required(idKey)}:${required(secretKey)}`)}`;
}

export type MuxAsset = {
  id: string;
  upload_id?: string;
  passthrough?: string;
  status: string;
  duration?: number;
  playback_ids?: { id: string; policy: string }[];
  tracks?: { type: string; max_width?: number; max_height?: number }[];
};

export async function mux<T>(path: string, body?: unknown) {
  return providerRequest<{ data: T }>(`https://api.mux.com/video/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: basic('MUX_TOKEN_ID', 'MUX_TOKEN_SECRET'),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function muxPlaybackToken(
  playbackId: string,
  expiresAt?: string | null,
) {
  const expiry = Math.min(
    Math.floor(Date.now() / 1000) + 600,
    expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : Infinity,
  );
  if (expiry <= Date.now() / 1000)
    throw new HttpError(404, 'This exposure has ended.');
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const message = `${encode({ alg: 'RS256', typ: 'JWT', kid: required('MUX_SIGNING_KEY_ID') })}.${encode({ sub: playbackId, aud: 'v', exp: expiry })}`;
  const configured = required('MUX_SIGNING_PRIVATE_KEY').replace(/\\n/g, '\n');
  const pem = configured.includes('BEGIN')
    ? configured
    : Buffer.from(configured, 'base64').toString('utf8');
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(message),
    createPrivateKey(pem),
  ).toString('base64url');
  return `${message}.${signature}`;
}
