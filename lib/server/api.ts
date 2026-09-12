import {
  CATEGORIES,
  captureModeForCategory,
  MAX_BID_MINOR,
  MAX_THUMBNAIL_BYTES,
  MIN_BID_MINOR,
  THUMBNAIL_BUCKET,
  thumbnailMime,
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
import { createCheckout, mux, muxPlaybackToken } from './providers';
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

const ownerDropFields =
  'id,category,capture_mode,title,amount_minor,currency,provider,payment_state,checkout_state,payment_reference,checkout_url,paid_at,state,mux_upload_id,mux_asset_id,mux_playback_id,media_state,thumbnail_path,thumbnail_verified,submitted_at,review_reason,auction_id,exposure_starts_at,exposure_ends_at,created_at';
const reviewDropFields =
  'id,category,capture_mode,title,amount_minor,currency,payment_state,paid_at,state,mux_asset_id,mux_playback_id,media_state,thumbnail_path,thumbnail_verified,submitted_at,review_reason,auction_id,exposure_starts_at,exposure_ends_at,created_at';

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

function validMuxUpload(id: unknown, value: unknown) {
  if (typeof id !== 'string' || !id || typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'storage.googleapis.com' ||
        url.hostname.endsWith('.mux.com'))
    );
  } catch {
    return false;
  }
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
    mux_upload_url: string;
    mux_upload_expires_at: string;
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
      return json(data);
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
      if (!setting('SUPABASE_SERVICE_ROLE_KEY') || !setting('SUPABASE_URL')) {
        const now = new Date();
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        return json(
          {
            auctionId: start.toISOString().slice(0, 10),
            serverNow: now.toISOString(),
            opensAt: start.toISOString(),
            closesAt: new Date(+start + 43200000).toISOString(),
            exposureEndsAt: new Date(+start + 86400000).toISOString(),
            phase: now.getUTCHours() < 12 ? 'bidding' : 'exposure',
            configured: false,
          },
          200,
          {
            'Cache-Control':
              'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
          },
        );
      }
      const { data, error } = await database().rpc('bought_advance');
      dbError(error);
      return json(data, 200, {
        'Cache-Control':
          'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
      });
    }
    if (exactPath(path, 'published') && method === 'GET') {
      if (!setting('SUPABASE_SERVICE_ROLE_KEY') || !setting('SUPABASE_URL'))
        return json({ entries: [] });
      const db = database();
      const { data: market, error: marketError } =
        await db.rpc('bought_advance');
      dbError(marketError);
      const { data, error } = await db
        .from('bought_ladder')
        .select(
          'drop_id,position,category,title,amount_minor,published_at,exposure_ends_at',
        )
        .eq('auction_id', market.auctionId)
        .order('position')
        .limit(100);
      dbError(error);
      return json({ entries: data }, 200, {
        'Cache-Control':
          'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
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
      });
    }

    if (!['drops', 'review'].includes(path[0]))
      throw new HttpError(404, 'Not found.');
    const user = await identity(request);
    const db = database();
    if (method === 'POST') {
      sameOrigin(request);
      requireJson(request);
      await rateLimit(
        `${user.id}:${path[0]}:${path[2] ?? 'create'}`,
        path[2] === 'checkout' ? 5 : 30,
      );
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
        method !== 'POST' ||
        path.length !== 2 ||
        !validUuid(path[1]) ||
        typeof body.assetId !== 'string' ||
        typeof body.approve !== 'boolean'
      )
        throw new HttpError(400, 'Choose a valid review decision.');
      const { error } = await db.rpc('bought_review', {
        p_drop_id: path[1],
        p_asset_id: body.assetId,
        p_reviewer: user.id,
        p_approve: body.approve,
        p_reason:
          typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      });
      dbError(error);
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
        // A failed/ambiguous provider create remains locked for reconciliation, preventing a second charge.
        const checkout = await createCheckout(drop);
        const { error } = await db
          .from('bought_drops')
          .update({
            payment_reference: checkout.reference,
            checkout_url: checkout.url,
            checkout_state: 'ready',
          })
          .eq('id', drop.id);
        dbError(error);
      }
      const current = await ownedDrop(drop.id, user.id);
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
              timeout: 86400,
              new_asset_settings: {
                playback_policies: ['signed'],
                passthrough: drop.id,
                video_quality: 'basic',
              },
            },
          );
          if (!validMuxUpload(upload.id, upload.url))
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
                Date.now() + 86400000,
              ).toISOString(),
              media_state: 'waiting',
              upload_claimed_at: null,
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
      const extension =
        body.contentType === 'image/jpeg'
          ? 'jpg'
          : body.contentType === 'image/png'
            ? 'png'
            : 'webp';
      const storagePath = `${user.id}/${drop.id}/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await db.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUploadUrl(storagePath);
      dbError(error);
      if (!data?.token)
        throw new HttpError(
          503,
          'Thumbnail upload is temporarily unavailable.',
        );
      const { data: changed, error: updateError } = await db
        .from('bought_drops')
        .update({ thumbnail_path: storagePath, thumbnail_verified: false })
        .eq('id', drop.id)
        .eq('payment_state', 'paid')
        .in('state', ['draft', 'rejected'])
        .select('id');
      dbError(updateError);
      if (!changed?.length)
        throw new HttpError(409, 'This broadcast has already been submitted.');
      return json({ path: storagePath, token: data.token });
    }
    if (path[2] === 'submit') {
      if (drop.payment_state !== 'paid')
        throw new HttpError(402, 'Wait for payment confirmation.');
      if (['draft', 'rejected'].includes(drop.state)) {
        if (!drop.thumbnail_path)
          throw new HttpError(400, 'Choose a thumbnail first.');
        const { data: file, error: fileError } = await db.storage
          .from(THUMBNAIL_BUCKET)
          .download(drop.thumbnail_path);
        dbError(fileError);
        if (
          !file ||
          file.size === 0 ||
          file.size > MAX_THUMBNAIL_BYTES ||
          !thumbnailMime(new Uint8Array(await file.arrayBuffer()))
        )
          throw new HttpError(400, 'Upload a valid image under 5 MB.');
        const { error } = await db
          .from('bought_drops')
          .update({ thumbnail_verified: true })
          .eq('id', drop.id)
          .eq('thumbnail_path', drop.thumbnail_path)
          .in('state', ['draft', 'rejected']);
        dbError(error);
      }
      const { error } = await db.rpc('bought_submit', { p_drop_id: drop.id });
      dbError(error);
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
