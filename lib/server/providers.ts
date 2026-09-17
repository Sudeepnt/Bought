import { createPrivateKey, sign } from 'node:crypto';
import type { Drop } from '../drop-domain';
import { HttpError, origin, required } from './config';

let cachedMuxPrivateKey: ReturnType<typeof createPrivateKey> | null = null;
let cachedMuxPrivateKeySource = '';

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
  const maxBytes = 2 * 1024 * 1024;
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    throw new HttpError(502, 'The provider returned an invalid response.');
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(502, 'The provider returned an invalid response.');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const raw = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(502, 'The provider returned an invalid response.');
  }
}

export function validProviderReference(value: unknown) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function trustedStripeCheckoutUrl(value: unknown) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'checkout.stripe.com' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443')
    );
  } catch {
    return false;
  }
}

export function validMuxUploadTarget(id: unknown, value: unknown) {
  if (!validProviderReference(id) || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      (url.hostname === 'storage.googleapis.com' ||
        url.hostname.endsWith('.mux.com'))
    );
  } catch {
    return false;
  }
}

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

function validRazorpayOrder(
  order: unknown,
  drop: Drop,
): order is RazorpayOrder {
  if (!order || typeof order !== 'object') return false;
  const candidate = order as Partial<RazorpayOrder>;
  return (
    validProviderReference(candidate.id) &&
    candidate.amount === drop.amount_minor &&
    typeof candidate.currency === 'string' &&
    candidate.currency.toUpperCase() === drop.currency &&
    candidate.receipt === drop.id &&
    typeof candidate.status === 'string' &&
    ['created', 'attempted', 'paid'].includes(candidate.status)
  );
}

async function reconcileRazorpayOrder(drop: Drop) {
  const query = new URLSearchParams({ receipt: drop.id, count: '2' });
  const response = await providerRequest<{ items?: RazorpayOrder[] }>(
    `https://api.razorpay.com/v1/orders?${query}`,
    {
      headers: {
        Authorization: basic('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'),
      },
    },
  );
  if (!Array.isArray(response.items))
    throw new HttpError(502, 'The payment provider returned invalid orders.');
  if (response.items.length === 0) return null;
  if (
    response.items.length !== 1 ||
    !validRazorpayOrder(response.items[0], drop)
  )
    throw new HttpError(
      502,
      'The existing payment order could not be reconciled safely.',
    );
  return { reference: response.items[0].id, url: null };
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
    const session = await providerRequest<{
      id: string;
      url: string;
      client_reference_id: string;
      amount_total: number;
      currency: string;
    }>('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}`,
        'Idempotency-Key': `bought:${drop.id}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    if (
      !validProviderReference(session.id) ||
      !trustedStripeCheckoutUrl(session.url) ||
      session.client_reference_id !== drop.id ||
      session.amount_total !== drop.amount_minor ||
      typeof session.currency !== 'string' ||
      session.currency.toUpperCase() !== drop.currency
    )
      throw new HttpError(
        502,
        'The payment provider returned an invalid checkout.',
      );
    return { reference: session.id, url: session.url };
  }
  if (drop.checkout_state === 'creating') {
    const existing = await reconcileRazorpayOrder(drop);
    if (existing) return existing;
  }
  const order = await providerRequest<RazorpayOrder>(
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
  if (!validRazorpayOrder(order, drop))
    throw new HttpError(
      502,
      'The payment provider returned an invalid checkout.',
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
  if (!cachedMuxPrivateKey || cachedMuxPrivateKeySource !== pem) {
    cachedMuxPrivateKey = createPrivateKey(pem);
    cachedMuxPrivateKeySource = pem;
  }
  const signature = sign(
    'RSA-SHA256',
    Buffer.from(message),
    cachedMuxPrivateKey,
  ).toString('base64url');
  return `${message}.${signature}`;
}
