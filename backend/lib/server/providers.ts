export type Topup = {
  id: string;
  provider: 'stripe' | 'razorpay';
  credit_minor: number;
  charge_minor: number;
  charge_currency: 'USD' | 'INR';
  checkout_state: 'new' | 'creating' | 'ready';
};
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

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

function validRazorpayOrder(
  order: unknown,
  topup: Topup,
): order is RazorpayOrder {
  if (!order || typeof order !== 'object') return false;
  const candidate = order as Partial<RazorpayOrder>;
  return (
    validProviderReference(candidate.id) &&
    candidate.amount === topup.charge_minor &&
    typeof candidate.currency === 'string' &&
    candidate.currency.toUpperCase() === topup.charge_currency &&
    candidate.receipt === topup.id &&
    typeof candidate.status === 'string' &&
    ['created', 'attempted', 'paid'].includes(candidate.status)
  );
}

async function reconcileRazorpayOrder(topup: Topup) {
  const query = new URLSearchParams({ receipt: topup.id, count: '2' });
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
    !validRazorpayOrder(response.items[0], topup)
  )
    throw new HttpError(
      502,
      'The existing payment order could not be reconciled safely.',
    );
  return { reference: response.items[0].id, url: null };
}

export async function createCheckout(topup: Topup) {
  if (topup.provider === 'stripe') {
    const params = new URLSearchParams({
      mode: 'payment',
      client_reference_id: topup.id,
      'metadata[topupId]': topup.id,
      'payment_intent_data[metadata][topupId]': topup.id,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(topup.charge_minor),
      'line_items[0][price_data][product_data][name]': 'Bought. credits',
      'line_items[0][quantity]': '1',
      success_url: `${origin()}/#advertise`,
      cancel_url: `${origin()}/#advertise`,
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
        'Idempotency-Key': `bought:${topup.id}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    if (
      !validProviderReference(session.id) ||
      !trustedStripeCheckoutUrl(session.url) ||
      session.client_reference_id !== topup.id ||
      session.amount_total !== topup.charge_minor ||
      typeof session.currency !== 'string' ||
      session.currency.toUpperCase() !== topup.charge_currency
    )
      throw new HttpError(
        502,
        'The payment provider returned an invalid checkout.',
      );
    return { reference: session.id, url: session.url };
  }
  if (topup.checkout_state === 'creating') {
    const existing = await reconcileRazorpayOrder(topup);
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
        amount: topup.charge_minor,
        currency: topup.charge_currency,
        receipt: topup.id,
        notes: { topupId: topup.id },
        partial_payment: false,
      }),
    },
  );
  if (!validRazorpayOrder(order, topup))
    throw new HttpError(
      502,
      'The payment provider returned an invalid checkout.',
    );
  return { reference: order.id, url: null };
}

export type StripeSession = {
  id: string;
  status?: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  client_reference_id?: string | null;
  payment_intent?: string | null;
};

// One Checkout Session, read with the secret key: how the server learns a card payment went through, webhook or not.
export async function stripeSession(sessionId: string) {
  if (!validProviderReference(sessionId)) throw new HttpError(400, 'Invalid checkout.');
  return providerRequest<StripeSession>(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}` } },
  );
}

export type Ready = { stripe: boolean; razorpay: boolean };

// UPI goes through Razorpay and card through Stripe; with only one of them connected it takes every top-up.
// null: nothing is connected yet, so points can't be bought (everyone still gets their free points).
export function chooseProvider(method: unknown, ready: Ready) {
  const order: ('stripe' | 'razorpay')[] = method === 'card' ? ['stripe', 'razorpay'] : ['razorpay', 'stripe'];
  const provider = order.find((p) => ready[p]) ?? null;
  return provider && { provider, method: provider === 'stripe' ? ('card' as const) : ('upi' as const) };
}

export function basic(idKey: string, secretKey: string) {
  return `Basic ${btoa(`${required(idKey)}:${required(secretKey)}`)}`;
}
