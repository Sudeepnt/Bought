import { validMedia } from '../drop-domain';
import { HttpError, required } from './config';
import { basic, mux, providerRequest, type MuxAsset } from './providers';
import { database, dbError, hmac, readBody, verifyWebhook } from './security';
import { transcribeMuxAudio } from './transcription';

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
  data?: {
    object?: Entity;
    id?: string;
    upload_id?: string;
    asset_id?: string;
    name?: string;
    resolution?: string;
    passthrough?: string;
  };
  payload?: { payment?: { entity: Entity }; refund?: { entity: Entity } };
};

export async function webhook(request: Request, provider: string) {
  if (!['stripe', 'razorpay', 'mux'].includes(provider))
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
  if (provider === 'mux') {
    if (!event.id || !event.data)
      throw new HttpError(400, 'Missing event information.');
    if (
      [
        'video.asset.static_rendition.ready',
        'video.asset.static_rendition.errored',
        'video.asset.static_rendition.skipped',
      ].includes(event.type ?? '')
    ) {
      if (
        event.data.name !== 'audio.m4a' &&
        event.data.resolution !== 'audio-only'
      )
        return;
      const assetId = event.data.asset_id;
      if (!assetId) throw new HttpError(400, 'Missing asset identity.');
      const asset = (
        await mux<MuxAsset>(`assets/${encodeURIComponent(assetId)}`)
      ).data;
      if (!asset.upload_id)
        throw new HttpError(400, 'Missing upload identity.');
      const { data: drop, error } = await db
        .from('bought_drops')
        .select(
          'id,title,category,mux_upload_id,mux_asset_id,mux_playback_id,media_state',
        )
        .eq('mux_upload_id', asset.upload_id)
        .maybeSingle();
      dbError(error);
      if (!drop) return; // A replaced upload cannot update the current take.
      if (drop.mux_asset_id !== assetId || drop.media_state !== 'ready')
        throw new HttpError(
          503,
          'The ready media event is still being linked. Retry delivery.',
        );
      if (
        event.type === 'video.asset.static_rendition.errored' ||
        event.type === 'video.asset.static_rendition.skipped'
      ) {
        const { error: updateError } = await db
          .from('bought_drops')
          .update({
            transcription_status: 'errored',
            transcription_error:
              'The audio-only rendition could not be prepared. Retry transcription from review.',
          })
          .eq('id', drop.id)
          .eq('mux_asset_id', assetId);
        dbError(updateError);
        return;
      }
      const playbackId =
        drop.mux_playback_id ??
        asset.playback_ids?.find((playback) => playback.policy === 'signed')
          ?.id;
      if (!playbackId)
        throw new HttpError(503, 'Signed playback is still being linked.');
      await transcribeMuxAudio({
        dropId: drop.id,
        assetId,
        playbackId,
        filename: event.data.name ?? 'audio.m4a',
        title: drop.title,
        category: drop.category,
      });
      return;
    }
    if (
      ![
        'video.asset.ready',
        'video.asset.errored',
        'video.upload.asset_created',
        'video.upload.errored',
      ].includes(event.type ?? '')
    )
      return;
    const uploadError = event.type === 'video.upload.errored';
    const assetId =
      event.type === 'video.upload.asset_created'
        ? event.data.asset_id
        : event.data.id;
    const asset = uploadError
      ? null
      : (await mux<MuxAsset>(`assets/${encodeURIComponent(assetId ?? '')}`))
          .data;
    const uploadId = uploadError ? event.data.id : asset?.upload_id;
    if (!uploadId) throw new HttpError(400, 'Missing upload identity.');
    const { data: drop, error } = await db
      .from('bought_drops')
      .select('id')
      .eq('mux_upload_id', uploadId)
      .maybeSingle();
    dbError(error);
    if (!drop) {
      if (asset?.passthrough) {
        const { data: pending, error: pendingError } = await db
          .from('bought_drops')
          .select('upload_claimed_at,mux_upload_id')
          .eq('id', asset.passthrough)
          .maybeSingle();
        dbError(pendingError);
        if (pending?.upload_claimed_at && !pending.mux_upload_id)
          throw new HttpError(
            503,
            'Upload is still being linked. Retry delivery.',
          );
      }
      return; // A replaced upload can never update the current take.
    }
    if (asset && asset.passthrough !== drop.id)
      throw new HttpError(400, 'Asset does not match this broadcast.');
    const ready =
      uploadError || asset?.status === 'ready' || asset?.status === 'errored';
    const playbackId =
      asset?.playback_ids?.find((p) => p.policy === 'signed')?.id ?? null;
    const valid =
      !!asset && asset.status === 'ready' && validMedia(asset) && !!playbackId;
    const { error: updateError } = await db.rpc('bought_media_event', {
      p_event_id: event.id,
      p_upload_id: uploadId,
      p_asset_id: asset?.id ?? null,
      p_playback_id: playbackId,
      p_ready: ready,
      p_valid: valid,
      p_reason:
        ready && !valid
          ? 'Please record a 1–120 second broadcast with a visible face and an audio track, then submit a new take.'
          : null,
    });
    dbError(updateError);
    return;
  }
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
  const { error } = await db.rpc('bought_payment_event', {
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
