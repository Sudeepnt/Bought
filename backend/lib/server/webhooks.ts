// Signed webhooks from the payment providers. Ad videos need none: the server checks each file in R2 itself.
import { HttpError, required } from './config';
import { basic, providerRequest } from './providers';
import { database, dbError, hmac, readBody, verifyWebhook } from './security';

type Entity = {
  id: string;
  order_id?: string;
  payment_id?: string;
  payment_intent?: string;
  status?: string;
  payment_status?: string;
  amount?: number;
  amount_total?: number;
  currency?: string;
  amount_refunded?: number;
};
type ProviderEvent = {
  id?: string;
  type?: string;
  event?: string;
  data?: { object?: Entity };
  payload?: { payment?: { entity: Entity }; refund?: { entity: Entity } };
};

export async function webhook(request: Request, provider: string) {
  if (!['stripe', 'razorpay'].includes(provider))
    throw new HttpError(404, 'Unknown provider.');
  const raw = await readBody(request, 1024 * 1024);
  const signature = request.headers.get(
    provider === 'razorpay' ? 'x-razorpay-signature' : `${provider}-signature`,
  );
  if (
    !(await verifyWebhook(
      raw,
      signature,
      required(`${provider.toUpperCase()}_WEBHOOK_SECRET`),
      provider !== 'razorpay',
    ))
  )
    throw new HttpError(400, 'Invalid webhook signature.');
  let event: ProviderEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid webhook payload.');
  }
  const db = database();
  let entity: Entity | undefined;
  let state: 'paid' | 'refunded' | 'disputed' = 'paid';
  let reference: string | null = null;
  let paymentId: string | null = null;
  let amount: number | undefined;
  if (provider === 'stripe') {
    entity = event.data?.object;
    if (!event.id || !entity)
      throw new HttpError(400, 'Missing event information.');
    if (
      [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ].includes(event.type ?? '')
    ) {
      if (entity.payment_status !== 'paid') return;
      reference = entity.id;
      paymentId = entity.payment_intent ?? null;
      amount = entity.amount_total;
    } else if (
      event.type === 'charge.refunded' ||
      event.type === 'charge.dispute.created'
    ) {
      state = event.type === 'charge.refunded' ? 'refunded' : 'disputed';
      paymentId = entity.payment_intent ?? null;
      // The original charge/intent amount is matched, including partial reversals.
      const intent = await providerRequest<Entity>(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentId ?? '')}`,
        {
          headers: { Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}` },
        },
      );
      amount = intent.amount;
      entity = intent;
    } else return;
  } else {
    if (event.event === 'payment.captured') {
      entity = event.payload?.payment?.entity;
      if (entity?.status !== 'captured') return;
    } else if (event.event === 'refund.processed') {
      const refund = event.payload?.refund?.entity;
      if (!refund?.payment_id)
        throw new HttpError(400, 'Missing payment information.');
      entity = await providerRequest<Entity>(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(refund.payment_id)}`,
        {
          headers: {
            Authorization: basic('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'),
          },
        },
      );
      state = 'refunded';
    } else return;
    reference = entity?.order_id ?? null;
    paymentId = entity?.id ?? null;
    amount = entity?.amount;
  }
  if (!paymentId || !Number.isSafeInteger(amount) || !entity?.currency)
    throw new HttpError(400, 'Incomplete payment details.');
  // Razorpay has no signed timestamp; use a body-derived ID so unsigned headers cannot bypass deduplication.
  const eventId =
    provider === 'stripe'
      ? event.id!
      : await hmac(required('RAZORPAY_WEBHOOK_SECRET'), raw);
  const { error } = await db.rpc('bought_ad_payment_event', {
    p_provider: provider,
    p_event_id: eventId,
    p_reference: reference,
    p_payment_id: paymentId,
    p_amount: amount,
    p_currency: entity.currency,
    p_state: state,
  });
  // Any database/linking failure returns a retryable response, never an acknowledged lost payment.
  if (error)
    throw new HttpError(503, 'Payment update is pending. Retry delivery.');
}
