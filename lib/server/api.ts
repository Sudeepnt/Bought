import {
  CATEGORIES,
  captureModeForCategory,
  MAX_BID_MINOR,
  MAX_THUMBNAIL_BYTES,
  MIN_BID_MINOR,
  THUMBNAIL_BUCKET,
  thumbnailMetadata,
  validUuid,
  type Drop,
} from '../drop-domain';
import {
  configuredProviders,
  HttpError,
  origin,
  required,
  setting,
} from './config';
import {
  createCheckout,
  mux,
  muxPlaybackToken,
  trustedStripeCheckoutUrl,
  validMuxUploadTarget,
  validProviderReference,
} from './providers';
import {
  constantEqual,
  database,
  dbError,
  identity,
  rateLimit,
  readBody,
  sameOrigin,
} from './security';
import { webhook } from './webhooks';
import { requestTranscription } from './transcription';
import {
  deletePushSubscription,
  flushMarketPushEvents,
  pushPublicKey,
  savePushSubscription,
  sendPushTest,
} from './push-notifications';

const ownerDropFields =
  'id,category,capture_mode,title,amount_minor,currency,provider,payment_state,checkout_state,payment_reference,checkout_url,paid_at,state,mux_upload_id,mux_asset_id,mux_playback_id,media_state,thumbnail_path,thumbnail_verified,submitted_at,review_reason,auction_id,exposure_starts_at,exposure_ends_at,transcription_status,transcribed_at,created_at';
const reviewDropFields =
  'id,category,capture_mode,title,amount_minor,currency,payment_state,paid_at,state,mux_asset_id,mux_playback_id,media_state,thumbnail_path,thumbnail_verified,submitted_at,review_reason,auction_id,exposure_starts_at,exposure_ends_at,transcription_status,transcript_english,editorial_summary,editorial_headline,editorial_quote,editorial_keywords,transcription_error,transcribed_at,created_at';

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (extraHeaders)
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return Response.json(data, {
    status,
    headers,
  });
}

function exactPath(path: string[], ...parts: string[]) {
  return (
    path.length === parts.length && path.every((part, i) => part === parts[i])
  );
}

function requireJson(request: Request) {
  if (
    request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase() !== 'application/json'
  )
    throw new HttpError(415, 'Send this request as JSON.');
}

async function ownedDrop(id: string, userId: string) {
  if (!validUuid(id)) throw new HttpError(400, 'Invalid broadcast ID.');
  const { data, error } = await database()
    .from('bought_drops')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  dbError(error);
  if (!data) throw new HttpError(404, 'Broadcast not found in your account.');
  return data as Drop & {
    mux_upload_url: string | null;
    mux_upload_expires_at: string | null;
  };
}

function editable(drop: Drop) {
  if (drop.payment_state !== 'paid')
    throw new HttpError(
      402,
      'Wait for server payment confirmation before recording.',
    );
  if (!['draft', 'rejected'].includes(drop.state))
    throw new HttpError(409, 'This broadcast has already been submitted.');
}

function fallbackMarket(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return {
    auctionId: start.toISOString().slice(0, 10),
    serverNow: now.toISOString(),
    opensAt: start.toISOString(),
    closesAt: new Date(+start + 43200000).toISOString(),
    exposureEndsAt: new Date(+start + 86400000).toISOString(),
    phase:
      now.getUTCHours() < 12 ? ('bidding' as const) : ('exposure' as const),
    configured: false,
  };
}

async function publicSnapshot() {
  if (!setting('SUPABASE_SERVICE_ROLE_KEY') || !setting('SUPABASE_URL'))
    return { market: fallbackMarket(), entries: [] };
  const db = database();
  const { data, error } = await db.rpc('bought_snapshot');
  const missingSnapshotFunction = ['42883', 'PGRST202'].includes(
    error?.code ?? '',
  );
  if (error && !missingSnapshotFunction) dbError(error);
  if (
    !error &&
    data &&
    typeof data === 'object' &&
    'market' in data &&
    'entries' in data &&
    Array.isArray(data.entries)
  ) {
    return data;
  }
  if (!missingSnapshotFunction)
    throw new HttpError(503, 'The market snapshot is unavailable.');

  // Zero-downtime migration compatibility: the old functions remain valid
  // while the additive snapshot migration rolls out ahead of the app deploy.
  const { data: market, error: marketError } = await db.rpc('bought_advance');
  dbError(marketError);
  const { data: entries, error: entriesError } = await db
    .from('bought_ladder')
    .select(
      'drop_id,position,category,title,amount_minor,published_at,exposure_ends_at',
    )
    .eq('auction_id', market.auctionId)
    .order('position')
    .limit(100);
  dbError(entriesError);
  return { market, entries: entries ?? [] };
}

export async function handleApi(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname
      .replace(/^\/api\/bought\/?/, '')
      .split('/')
      .filter(Boolean);
    const method = request.method;
    if (!['GET', 'POST'].includes(method))
      return json({ error: 'Method not allowed.' }, 405, {
        Allow: 'GET, POST',
      });
    if (path[0] === 'webhooks' && method === 'POST' && path.length === 2) {
      await webhook(request, path[1]);
      return json({ received: true });
    }
    if (exactPath(path, 'cron') && (method === 'GET' || method === 'POST')) {
      if (
        !constantEqual(
          request.headers.get('authorization') ?? '',
          `Bearer ${required('CRON_SECRET')}`,
        )
      )
        throw new HttpError(401, 'Unauthorized.');
      const { data, error } = await database().rpc('bought_advance');
      dbError(error);
      await flushMarketPushEvents().catch((pushError: unknown) => {
        console.error(
          'BOUGHT push delivery is pending:',
          pushError instanceof Error ? pushError.message : 'Unknown error.',
        );
      });
      return json(data);
    }
    if (exactPath(path, 'push', 'key') && method === 'GET')
      return json({ publicKey: pushPublicKey() });
    if (path[0] === 'push' && path.length === 2) {
      if (method !== 'POST')
        return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
      if (!['subscription', 'unsubscribe', 'test'].includes(path[1]))
        throw new HttpError(404, 'Not found.');
      sameOrigin(request);
      requireJson(request);
      const user = await identity(request);
      await rateLimit(`push:${user.id}:${path[1]}`, 12, 60);
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(await readBody(request));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, 'Invalid request.');
      }
      if (!body || Array.isArray(body) || typeof body !== 'object')
        throw new HttpError(400, 'Invalid request.');
      if (path[1] === 'subscription') {
        await savePushSubscription(user.id, body.subscription);
        return json({ saved: true });
      }
      if (path[1] === 'unsubscribe') {
        await deletePushSubscription(user.id, body.endpoint);
        return json({ removed: true });
      }
      await sendPushTest(user.id);
      return json({ sent: true });
    }
    if (exactPath(path, 'config') && method === 'GET')
      return json(
        {
          supabaseUrl: setting('SUPABASE_URL') ?? null,
          supabaseKey: setting('SUPABASE_PUBLISHABLE_KEY') ?? null,
          providers: configuredProviders(),
        },
        200,
        {
          'Cache-Control':
            'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
        },
      );
    if (exactPath(path, 'market') && method === 'GET') {
      const snapshot = await publicSnapshot();
      return json(snapshot.market, 200, {
        'Cache-Control':
          'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
      });
    }
    if (exactPath(path, 'published') && method === 'GET') {
      const snapshot = await publicSnapshot();
      return json({ entries: snapshot.entries }, 200, {
        'Cache-Control':
          'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
      });
    }
    if (exactPath(path, 'snapshot') && method === 'GET') {
      const snapshot = await publicSnapshot();
      return json(snapshot, 200, {
        'Cache-Control':
          'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
      });
    }
    if (path[0] === 'media' && method === 'GET' && path.length === 2) {
      if (!validUuid(path[1]))
        throw new HttpError(400, 'Invalid broadcast ID.');
      const db = database();
      const { data: drop, error } = await db
        .from('bought_drops')
        .select('*')
        .eq('id', path[1])
        .maybeSingle();
      dbError(error);
      if (!drop) throw new HttpError(404, 'Broadcast not found.');
      const { data: market, error: marketError } =
        await db.rpc('bought_advance');
      dbError(marketError);
      const isPublic =
        drop.state === 'published' &&
        drop.payment_state === 'paid' &&
        drop.auction_id === market.auctionId;
      if (!isPublic) {
        const user = await identity(request);
        if (
          drop.user_id !== user.id &&
          user.app_metadata.bought_moderator !== true
        )
          throw new HttpError(404, 'Broadcast not found.');
      }
      if (!drop.mux_playback_id || !drop.thumbnail_verified)
        throw new HttpError(409, 'Broadcast is still processing.');
      const { data: thumbnail, error: thumbnailError } = await db.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUrl(drop.thumbnail_path, 600);
      dbError(thumbnailError);
      return json({
        playbackId: drop.mux_playback_id,
        token: muxPlaybackToken(
          drop.mux_playback_id,
          isPublic ? drop.exposure_ends_at : null,
        ),
        thumbnail: thumbnail?.signedUrl,
        captionsVtt:
          drop.transcription_status === 'ready' ? drop.captions_vtt : null,
      });
    }

    if (!['drops', 'review'].includes(path[0]))
      throw new HttpError(404, 'Not found.');
    const user = await identity(request);
    const db = database();
    if (method === 'POST') {
      sameOrigin(request);
      requireJson(request);
      const action =
        path[0] === 'review'
          ? path[2] === 'transcribe'
            ? 'transcribe'
            : 'decision'
          : (path[2] ?? 'create');
      const [limit, seconds] =
        action === 'create'
          ? [10, 3600]
          : action === 'checkout'
            ? [10, 600]
            : action === 'upload'
              ? [20, 3600]
              : action === 'thumbnail' || action === 'submit'
                ? [30, 3600]
                : action === 'decision'
                  ? [60, 60]
                  : [30, 60];
      await rateLimit(`${user.id}:${path[0]}:${action}`, limit, seconds);
    }
    let body: Record<string, unknown> = {};
    if (method === 'POST') {
      try {
        body = JSON.parse(await readBody(request));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(400, 'Invalid request.');
      }
      if (!body || Array.isArray(body) || typeof body !== 'object')
        throw new HttpError(400, 'Invalid request.');
    }
    if (path[0] === 'review') {
      if (user.app_metadata.bought_moderator !== true)
        throw new HttpError(403, 'Moderator access is required.');
      if (method === 'GET' && path.length === 1) {
        const { data, error } = await db
          .from('bought_drops')
          .select(reviewDropFields)
          .eq('state', 'review')
          .order('submitted_at')
          .limit(50);
        dbError(error);
        return json({ drops: data });
      }
      if (
        method === 'POST' &&
        path.length === 3 &&
        path[2] === 'transcribe' &&
        validUuid(path[1])
      ) {
        const { data: drop, error } = await db
          .from('bought_drops')
          .select(
            'id,title,category,mux_asset_id,mux_playback_id,media_state,state',
          )
          .eq('id', path[1])
          .maybeSingle();
        dbError(error);
        if (!drop || !['review', 'published'].includes(drop.state))
          throw new HttpError(404, 'Broadcast not found in the review queue.');
        if (drop.media_state !== 'ready')
          throw new HttpError(409, 'The broadcast media is still processing.');
        const result = await requestTranscription(drop);
        return json(result);
      }
      if (
        method !== 'POST' ||
        path.length !== 2 ||
        !validUuid(path[1]) ||
        typeof body.assetId !== 'string' ||
        typeof body.approve !== 'boolean'
      )
        throw new HttpError(400, 'Choose a valid review decision.');
      if (body.approve) {
        const { data: transcript, error } = await db
          .from('bought_drops')
          .select('mux_asset_id,transcription_asset_id,transcription_status')
          .eq('id', path[1])
          .maybeSingle();
        dbError(error);
        if (
          !transcript ||
          transcript.transcription_status !== 'ready' ||
          transcript.transcription_asset_id !== transcript.mux_asset_id
        )
          throw new HttpError(
            409,
            'Generate and review the English transcript before publishing.',
          );
      }
      const { error } = await db.rpc('bought_review', {
        p_drop_id: path[1],
        p_asset_id: body.assetId,
        p_reviewer: user.id,
        p_approve: body.approve,
        p_reason:
          typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      });
      dbError(error);
      await flushMarketPushEvents().catch((pushError: unknown) => {
        console.error(
          'BOUGHT push delivery is pending:',
          pushError instanceof Error ? pushError.message : 'Unknown error.',
        );
      });
      return json({ saved: true });
    }
    if (path.length === 1 && method === 'GET') {
      const { data, error } = await db
        .from('bought_drops')
        .select(ownerDropFields)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      dbError(error);
      return json({ drops: data });
    }
    if (path.length === 1 && method === 'POST') {
      if (
        !validUuid(body.id) ||
        typeof body.category !== 'string' ||
        !(CATEGORIES as readonly string[]).includes(body.category) ||
        !Number.isSafeInteger(body.amountMinor) ||
        Number(body.amountMinor) < MIN_BID_MINOR ||
        Number(body.amountMinor) > MAX_BID_MINOR ||
        Number(body.amountMinor) % 100 !== 0 ||
        !['stripe', 'razorpay'].includes(String(body.provider)) ||
        typeof body.title !== 'string' ||
        body.title.trim().length < 3 ||
        body.title.trim().length > 120
      )
        throw new HttpError(400, 'Check your category, title, and bid amount.');
      const { error } = await db.from('bought_drops').insert({
        id: body.id,
        user_id: user.id,
        category: body.category,
        capture_mode: captureModeForCategory(body.category),
        title: body.title.trim(),
        amount_minor: body.amountMinor,
        provider: body.provider,
      });
      if (error && error.code !== '23505') dbError(error);
      // An idempotent retry only resolves to the current user's own drop.
      const saved = await ownedDrop(body.id, user.id);
      if (
        saved.category !== body.category ||
        saved.capture_mode !== captureModeForCategory(body.category) ||
        saved.amount_minor !== body.amountMinor ||
        saved.provider !== body.provider ||
        saved.title !== body.title.trim()
      )
        throw new HttpError(
          409,
          'This draft ID already has different details. Refresh to continue.',
        );
      return json({ dropId: saved.id }, 201);
    }
    if (path.length < 2 || path.length > 3)
      throw new HttpError(404, 'Not found.');
    if (
      path.length === 3 &&
      !['checkout', 'upload', 'thumbnail', 'submit'].includes(path[2])
    )
      throw new HttpError(404, 'Not found.');
    const drop = await ownedDrop(path[1], user.id);
    if (method === 'GET' && path.length === 2) {
      const { data, error } = await db
        .from('bought_drops')
        .select(ownerDropFields)
        .eq('id', drop.id)
        .single();
      dbError(error);
      return json({ drop: data });
    }
    if (method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    if (path[2] === 'checkout') {
      if (!configuredProviders()[drop.provider])
        throw new HttpError(
          503,
          'Payments are not available yet. Your draft is saved.',
        );
      const { data: claimed, error: claimError } = await db.rpc(
        'bought_claim_checkout',
        { p_drop_id: drop.id },
      );
      dbError(claimError);
      if (claimed) {
        // Read the claimed state back before provider reconciliation. Stripe
        // retries are idempotent and Razorpay checks the unique receipt first.
        const claimedDrop = await ownedDrop(drop.id, user.id);
        const checkout = await createCheckout(claimedDrop);
        const { error } = await db
          .from('bought_drops')
          .update({
            payment_reference: checkout.reference,
            checkout_url: checkout.url,
            checkout_state: 'ready',
            checkout_claimed_at: null,
          })
          .eq('id', drop.id);
        dbError(error);
      }
      const current = await ownedDrop(drop.id, user.id);
      if (
        !validProviderReference(current.payment_reference) ||
        (current.provider === 'stripe' &&
          !trustedStripeCheckoutUrl(current.checkout_url))
      )
        throw new HttpError(
          503,
          'Checkout is temporarily unavailable. Your draft is saved.',
        );
      return json({
        provider: current.provider,
        url: current.checkout_url,
        orderId: current.payment_reference,
        amount: current.amount_minor,
        currency: 'USD',
        key:
          current.provider === 'razorpay'
            ? required('RAZORPAY_KEY_ID')
            : undefined,
      });
    }
    if (path[2] === 'upload') {
      editable(drop);
      const { data: claimed, error: claimError } = await db.rpc(
        'bought_claim_upload',
        { p_drop_id: drop.id, p_replace: body.replace === true },
      );
      dbError(claimError);
      if (claimed) {
        try {
          const { data: upload } = await mux<{ id: string; url: string }>(
            'uploads',
            {
              cors_origin: origin(),
              timeout: 7200,
              new_asset_settings: {
                playback_policies: ['signed'],
                passthrough: drop.id,
                max_resolution_tier: '1080p',
                // Keep initial on-demand broadcasts on Mux's lowest-cost
                // encoding tier. This can be raised for a specific future
                // live or premium-media workflow.
                video_quality: 'basic',
                inputs: [
                  {
                    generated_subtitles: [
                      {
                        language_code: 'auto',
                        name: 'Original captions',
                        passthrough: drop.id,
                      },
                    ],
                  },
                ],
              },
            },
          );
          if (!validMuxUploadTarget(upload.id, upload.url))
            throw new HttpError(
              502,
              'The video provider returned an invalid upload target.',
            );
          const { error } = await db
            .from('bought_drops')
            .update({
              mux_upload_id: upload.id,
              mux_upload_url: upload.url,
              mux_upload_expires_at: new Date(
                Date.now() + 7200000,
              ).toISOString(),
              media_state: 'waiting',
              upload_claimed_at: null,
              transcription_status: 'pending',
              transcription_asset_id: null,
              transcript_english: null,
              captions_vtt: null,
              editorial_summary: null,
              editorial_headline: null,
              editorial_quote: null,
              editorial_keywords: [],
              transcription_error: null,
              transcription_claimed_at: null,
              transcribed_at: null,
              transcription_attempts: 0,
            })
            .eq('id', drop.id);
          dbError(error);
        } catch (error) {
          await db
            .from('bought_drops')
            .update({ upload_claimed_at: null })
            .eq('id', drop.id);
          throw error;
        }
      }
      const current = await ownedDrop(drop.id, user.id);
      if (!validMuxUploadTarget(current.mux_upload_id, current.mux_upload_url))
        throw new HttpError(
          503,
          'The upload target is unavailable. Try again shortly.',
        );
      return json({
        url: current.mux_upload_url,
        uploadId: current.mux_upload_id,
      });
    }
    if (path[2] === 'thumbnail') {
      editable(drop);
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(
          String(body.contentType),
        )
      )
        throw new HttpError(400, 'Use a JPEG, PNG, or WebP thumbnail.');
      const prefix = `${user.id}/${drop.id}/`;
      const storagePath = `${prefix}thumbnail-staging`;
      const { data: previousPath, error: claimError } = await db.rpc(
        'bought_claim_thumbnail',
        {
          p_drop_id: drop.id,
          p_path: storagePath,
        },
      );
      dbError(claimError);
      const { data, error } = await db.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });
      dbError(error);
      if (!data?.token)
        throw new HttpError(
          503,
          'Thumbnail upload is temporarily unavailable.',
        );
      if (
        typeof previousPath === 'string' &&
        previousPath.startsWith(prefix) &&
        previousPath !== storagePath
      ) {
        // Once a rejected broadcast starts a new thumbnail, its previous
        // immutable version is no longer referenced and can be removed.
        await db.storage.from(THUMBNAIL_BUCKET).remove([previousPath]);
      }
      return json({ path: storagePath, token: data.token });
    }
    if (path[2] === 'submit') {
      if (drop.payment_state !== 'paid')
        throw new HttpError(402, 'Wait for payment confirmation.');
      if (['draft', 'rejected'].includes(drop.state)) {
        if (!drop.thumbnail_path)
          throw new HttpError(400, 'Choose a thumbnail first.');
        if (!drop.thumbnail_verified) {
          const stagingPath = `${user.id}/${drop.id}/thumbnail-staging`;
          if (drop.thumbnail_path !== stagingPath)
            throw new HttpError(409, 'Choose the thumbnail again.');
          const { data: file, error: fileError } = await db.storage
            .from(THUMBNAIL_BUCKET)
            .download(stagingPath);
          dbError(fileError);
          if (!file || file.size === 0 || file.size > MAX_THUMBNAIL_BYTES)
            throw new HttpError(400, 'Upload a valid image under 5 MB.');
          const bytes = new Uint8Array(await file.arrayBuffer());
          const thumbnail = thumbnailMetadata(bytes);
          if (
            !thumbnail ||
            thumbnail.width < 240 ||
            thumbnail.height < 240 ||
            thumbnail.width > 1280 ||
            thumbnail.height > 1280
          )
            throw new HttpError(
              400,
              'Upload a valid image between 240 and 1280 pixels per side.',
            );
          const mime = thumbnail.mime;
          const extension =
            mime === 'image/jpeg'
              ? 'jpg'
              : mime === 'image/png'
                ? 'png'
                : 'webp';
          const verifiedPath = `${user.id}/${drop.id}/verified-${crypto.randomUUID()}.${extension}`;
          const { error: verifiedUploadError } = await db.storage
            .from(THUMBNAIL_BUCKET)
            .upload(verifiedPath, bytes, {
              cacheControl: '31536000',
              contentType: mime,
              upsert: false,
            });
          dbError(verifiedUploadError);
          const { data: changed, error: updateError } = await db
            .from('bought_drops')
            .update({
              thumbnail_path: verifiedPath,
              thumbnail_verified: true,
            })
            .eq('id', drop.id)
            .eq('thumbnail_path', stagingPath)
            .eq('thumbnail_verified', false)
            .in('state', ['draft', 'rejected'])
            .select('id');
          if (updateError || !changed?.length) {
            await db.storage.from(THUMBNAIL_BUCKET).remove([verifiedPath]);
            dbError(updateError);
            throw new HttpError(
              409,
              'The thumbnail changed. Refresh and try again.',
            );
          }
        }
      }
      const { error } = await db.rpc('bought_submit', { p_drop_id: drop.id });
      dbError(error);
      await db.storage
        .from(THUMBNAIL_BUCKET)
        .remove([`${user.id}/${drop.id}/thumbnail-staging`]);
      return json({ submitted: true });
    }
    throw new HttpError(404, 'Not found.');
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    // Do not put provider payloads, tokens, or personal data into application logs.
    console.error(
      'BOUGHT request failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return json(
      {
        error:
          'Something went wrong. Your saved broadcast is safe; please try again.',
      },
      500,
    );
  }
}
