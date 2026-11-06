// The Advertise page's API. Same shape as Bought's: one handler, typed errors, rate-limited writes,
// the database owns the rules, Mux and the payment providers talk back through signed webhooks.
import {
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_SECONDS,
  THUMBNAIL_BUCKET,
  thumbnailMetadata,
  validUuid,
} from '../drop-domain';
import {
  RECORDING_RETENTION_MS,
  recordingSavedAt,
} from '../recording-retention';
import {
  configuredProviders,
  HttpError,
  isLive,
  missingKeys,
  origin,
  required,
  setting,
} from './config';
import {
  createCheckout,
  deleteMuxAsset,
  mux,
  muxPlaybackToken,
  trustedStripeCheckoutUrl,
  validMuxUploadTarget,
  validProviderReference,
  type Topup,
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

const KINDS = ['video', 'image', 'classified'] as const;
const SPOTS = ['top', 'front', 'feed-a', 'half', 'feed-e', 'clip', 'cls'];
const IMAGE_URL_SECONDS = 6 * 3600;
const FIELD_LIMITS: Record<string, number> = {
  thumb: 32,
  who: 48,
  about: 80,
  line: 120,
  sub: 70,
  cta: 60,
  web: 300,
  social: 300,
  email: 254,
  link: 300,
  fname: 120,
};

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (extraHeaders)
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return Response.json(data, { status, headers });
}

function exactPath(path: string[], ...parts: string[]) {
  return (
    path.length === parts.length && path.every((part, i) => part === parts[i])
  );
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

async function jsonBody(request: Request) {
  if (
    request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase() !== 'application/json'
  )
    throw new HttpError(415, 'Send this request as JSON.');
  let body: unknown;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid request.');
  }
  if (!body || Array.isArray(body) || typeof body !== 'object')
    throw new HttpError(400, 'Invalid request.');
  return body as Record<string, unknown>;
}

function clientAddress(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  );
}

// An optional identity: a stranger can read the market, a bad token just reads as a stranger.
async function maybeIdentity(request: Request) {
  if (!request.headers.get('authorization')) return null;
  try {
    return await identity(request);
  } catch {
    return null;
  }
}

async function ownedAd(id: unknown, userId: string) {
  if (!validUuid(id)) throw new HttpError(400, 'Invalid ad ID.');
  const { data, error } = await database()
    .from('bought_ads')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  dbError(error);
  if (!data) throw new HttpError(404, 'Ad not found in your account.');
  return data as AdRow;
}

type AdRow = {
  id: string;
  user_id: string;
  spot: string;
  kind: (typeof KINDS)[number];
  title: string;
  fields: Record<string, unknown>;
  state: string;
  media_state: string;
  mux_upload_id: string | null;
  mux_upload_url: string | null;
  mux_upload_expires_at: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  thumbnail_path: string | null;
  thumbnail_verified: boolean;
  problem: string | null;
  submitted_at: string | null;
  created_at: string;
};

// An ad can change until it has won: from the close on, the issue's ads are fixed.
async function editable(ad: AdRow) {
  const { data, error } = await database()
    .from('bought_ad_results')
    .select('id')
    .eq('ad_id', ad.id)
    .in('status', ['won', 'live'])
    .limit(1);
  dbError(error);
  if (data?.length)
    throw new HttpError(409, 'This ad has won its spot, so it can no longer change.');
}

// Only plain text and links reach the paper; the page escapes on render as well.
function cleanFields(raw: unknown) {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const input = raw as Record<string, unknown>;
  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    if (typeof input[key] === 'string' && input[key]) {
      const value = (input[key] as string).trim().slice(0, max);
      if (['web', 'social', 'link'].includes(key)) {
        if (!/^https?:\/\//i.test(value)) continue;
      }
      out[key] = value;
    }
  }
  if (Array.isArray(input.script))
    out.script = input.script
      .filter((line): line is string => typeof line === 'string')
      .slice(0, 12)
      .map((line) => line.slice(0, 160));
  for (const key of ['trimStart', 'len', 'dur']) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value >= 0 && value <= MAX_VIDEO_SECONDS)
      out[key] = Math.round(value);
  }
  const mark = input.mark as { bg?: unknown; fg?: unknown } | undefined;
  const colour = (c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  if (mark && colour(mark.bg) && colour(mark.fg))
    out.mark = { bg: mark.bg, fg: mark.fg };
  return out;
}

function sameFields(a: Record<string, unknown>, b: Record<string, unknown>) {
  const stable = (x: Record<string, unknown>) =>
    JSON.stringify(Object.keys(x).sort().map((k) => [k, x[k]]));
  return stable(a) === stable(b);
}

async function signedImage(path: string | null) {
  if (!path || path.endsWith('-staging')) return null;
  const { data } = await database()
    .storage.from(THUMBNAIL_BUCKET)
    .createSignedUrl(path, IMAGE_URL_SECONDS);
  return data?.signedUrl ?? null;
}

// The market hands back storage paths. The page only ever gets short-lived signed links.
async function signCreative(cre: Record<string, unknown> | undefined) {
  if (!cre) return;
  const path = typeof cre.image === 'string' ? cre.image : null;
  const url = await signedImage(path);
  if (url) cre.signedImage = url;
  delete cre.image;
}

async function market(userId: string | null) {
  const { data, error } = await database().rpc('bought_ad_market', {
    p_user: userId,
  });
  dbError(error);
  const me = data?.me;
  if (me) {
    await Promise.all(
      [...(me.my ?? []), ...(me.past ?? [])].map((row: { cre?: Record<string, unknown> }) =>
        signCreative(row.cre),
      ),
    );
  }
  return data;
}

async function expireUnusedRecordings() {
  if (!setting('MUX_TOKEN_ID') || !setting('MUX_TOKEN_SECRET')) return 0;
  const db = database();
  const { data, error } = await db
    .from('bought_ads')
    .select('id,state,mux_asset_id,mux_upload_expires_at,created_at')
    .in('state', ['draft', 'rejected'])
    .in('media_state', ['ready', 'errored'])
    .not('mux_asset_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50);
  dbError(error);
  let expired = 0;
  for (const ad of data ?? []) {
    const savedAt = recordingSavedAt({
      uploadExpiresAt: ad.mux_upload_expires_at,
      createdAt: ad.created_at,
    });
    if (savedAt + RECORDING_RETENTION_MS > Date.now()) continue;
    try {
      await deleteMuxAsset(ad.mux_asset_id);
      const { error: updateError } = await db
        .from('bought_ads')
        .update({
          mux_upload_id: null,
          mux_upload_url: null,
          mux_upload_expires_at: null,
          mux_asset_id: null,
          mux_playback_id: null,
          media_state: 'none',
          problem:
            'Unused recording expired after 14 days. Record a new take to continue.',
        })
        .eq('id', ad.id)
        .eq('mux_asset_id', ad.mux_asset_id)
        .in('state', ['draft', 'rejected']);
      dbError(updateError);
      expired += 1;
    } catch (cleanupError) {
      console.error(
        'BOUGHT recording cleanup is pending:',
        cleanupError instanceof Error
          ? cleanupError.message
          : 'Unknown cleanup error.',
      );
    }
  }
  return expired;
}

export async function tick() {
  const expiredRecordings = await expireUnusedRecordings();
  const { data, error } = await database().rpc('bought_ad_tick');
  dbError(error);
  return { ...data, expiredRecordings };
}

// ---------- the desk: only the password-protected /admin server calls these ----------
async function admin(request: Request, path: string[]) {
  const db = database();
  // what the desk shows: withdrawals to pay by hand, and what sold
  if (exactPath(path, 'admin', 'money') && request.method === 'GET') {
    const { data: withdrawals, error: withdrawalError } = await db
      .from('bought_withdrawals')
      .select('id,amount_minor,requested_at,user_id')
      .eq('state', 'requested')
      .order('requested_at');
    dbError(withdrawalError);
    const { data: sold, error: soldError } = await db
      .from('bought_ad_results')
      .select('issue,spot,rank,price_minor,status,invoice,ad_id')
      .order('issue', { ascending: false })
      .limit(40);
    dbError(soldError);
    return json({ withdrawals, sold });
  }
  if (exactPath(path, 'admin', 'live') && request.method === 'POST') {
    const body = await jsonBody(request);
    if (!validDate(body.issue)) throw new HttpError(400, 'Invalid issue date.');
    const { data, error } = await db.rpc('bought_ad_mark_live', {
      p_issue: body.issue,
    });
    dbError(error);
    return json({ live: data });
  }
  if (exactPath(path, 'admin', 'withdrawal') && request.method === 'POST') {
    const body = await jsonBody(request);
    const { error } = await db
      .from('bought_withdrawals')
      .update({ state: 'paid', paid_at: new Date().toISOString() })
      .eq('id', Number(body.id))
      .eq('state', 'requested');
    dbError(error);
    return json({ saved: true });
  }
  throw new HttpError(404, 'Not found.');
}

function isDesk(request: Request) {
  const secret = setting('CRON_SECRET');
  return (
    !!secret &&
    constantEqual(
      request.headers.get('authorization') ?? '',
      `Bearer ${secret}`,
    )
  );
}

// ---------- signed-in advertiser ----------
async function advertiser(request: Request, path: string[]) {
  const user = await identity(request);
  const db = database();
  const action = path.slice(1).filter((p) => !validUuid(p)).join(':');
  sameOrigin(request);
  const [limit, seconds]: [number, number] =
    action === 'bid'
      ? [60, 60]
      : action === 'topup'
        ? [10, 600]
        : action === 'ads:upload'
          ? [20, 3600]
          : action === 'withdraw'
            ? [10, 3600]
            : [60, 600];
  await rateLimit(`${user.id}:${action}`, limit, seconds);
  const body = await jsonBody(request);

  if (exactPath(path, 'ads', 'account')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : '';
    const gstin =
      typeof body.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
    if (!name || name.length > 120)
      throw new HttpError(400, 'Add your business name.');
    if (!country || country.length > 60)
      throw new HttpError(400, 'Choose your country.');
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin))
      throw new HttpError(400, 'A GSTIN has 15 letters and digits.');
    // The email is the one the sign-in proved, never the one typed into a form. Its first account gets 100 free points.
    if (!user.email) throw new HttpError(400, 'Your sign-in has no email address.');
    const { data, error } = await db.rpc('bought_ad_open_account', {
      p_user: user.id,
      p_email: user.email,
      p_name: name,
      p_country: country,
      p_gstin: gstin || null,
      p_method: body.method === 'card' ? 'card' : 'upi',
    });
    dbError(error);
    return json(data);
  }

  if (exactPath(path, 'ads', 'ads')) {
    if (
      !validUuid(body.id) ||
      !SPOTS.includes(String(body.spot)) ||
      !KINDS.includes(body.kind as (typeof KINDS)[number])
    )
      throw new HttpError(400, 'Check your ad and try again.');
    if ((body.kind === 'classified') !== (body.spot === 'cls'))
      throw new HttpError(400, 'That kind of ad does not fit this spot.');
    const fields = cleanFields(body.fields);
    const title =
      String(fields.line ?? fields.about ?? fields.thumb ?? '').trim() ||
      'Advertiser video';
    const { error } = await db
      .from('bought_ads')
      .upsert(
        { id: body.id, user_id: user.id, spot: body.spot, kind: body.kind, title, fields },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (error && error.code !== '23505') dbError(error);
    // An idempotent retry only ever resolves to this user's own ad.
    const saved = await ownedAd(body.id, user.id);
    if (saved.spot !== body.spot || saved.kind !== body.kind)
      throw new HttpError(409, 'This ad ID already has different details.');
    if (sameFields(saved.fields, fields) === false) {
      await editable(saved);
      const { error: updateError } = await db
        .from('bought_ads')
        .update({ title, fields })
        .eq('id', saved.id);
      dbError(updateError);
    }
    return json({ adId: saved.id }, 201);
  }

  if (path[1] === 'ads' && path.length === 4) {
    const ad = await ownedAd(path[2], user.id);
    if (path[3] === 'upload') {
      await editable(ad);
      const replacedAssetId = ad.mux_asset_id;
      const { data: claimed, error: claimError } = await db.rpc(
        'bought_ad_claim_upload',
        { p_ad_id: ad.id, p_replace: body.replace === true },
      );
      dbError(claimError);
      if (claimed) {
        let muxUploadCreated = false;
        try {
          const { data: upload } = await mux<{ id: string; url: string }>(
            'uploads',
            {
              cors_origin: origin(),
              timeout: 7200,
              new_asset_settings: {
                playback_policies: ['signed'],
                passthrough: ad.id,
                max_resolution_tier: '1080p',
                // Mux's lowest-cost encoding tier, as Bought uses for on-demand video.
                video_quality: 'basic',
              },
            },
          );
          muxUploadCreated = true;
          if (!validMuxUploadTarget(upload.id, upload.url))
            throw new HttpError(
              502,
              'The video provider returned an invalid upload target.',
            );
          const { error } = await db
            .from('bought_ads')
            .update({
              mux_upload_id: upload.id,
              mux_upload_url: upload.url,
              mux_upload_expires_at: new Date(
                Date.now() + 7200000,
              ).toISOString(),
              upload_quota_date: null,
              media_state: 'waiting',
              upload_claimed_at: null,
            })
            .eq('id', ad.id);
          dbError(error);
          if (replacedAssetId)
            await deleteMuxAsset(replacedAssetId).catch(() =>
              console.error('BOUGHT replaced recording cleanup is pending.'),
            );
        } catch (error) {
          if (muxUploadCreated) {
            await db
              .from('bought_ads')
              .update({ upload_claimed_at: null, upload_quota_date: null })
              .eq('id', ad.id);
          } else {
            const { error: releaseError } = await db.rpc(
              'bought_ad_release_upload_quota',
              { p_ad_id: ad.id },
            );
            if (releaseError)
              console.error('BOUGHT upload quota release is pending.');
          }
          throw error;
        }
      }
      const current = await ownedAd(ad.id, user.id);
      if (!validMuxUploadTarget(current.mux_upload_id, current.mux_upload_url))
        throw new HttpError(
          503,
          'The upload target is unavailable. Try again shortly.',
        );
      return json({ url: current.mux_upload_url, uploadId: current.mux_upload_id });
    }
    if (path[3] === 'image') {
      await editable(ad);
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(
          String(body.contentType),
        )
      )
        throw new HttpError(400, 'Use a JPEG, PNG, or WebP image.');
      const prefix = `${user.id}/${ad.id}/`;
      const storagePath = `${prefix}image-staging`;
      const { data: previousPath, error: claimError } = await db.rpc(
        'bought_ad_claim_thumbnail',
        { p_ad_id: ad.id, p_path: storagePath },
      );
      dbError(claimError);
      const { data, error } = await db.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true });
      dbError(error);
      if (!data?.token)
        throw new HttpError(503, 'Image upload is temporarily unavailable.');
      if (
        typeof previousPath === 'string' &&
        previousPath.startsWith(prefix) &&
        previousPath !== storagePath
      )
        await db.storage.from(THUMBNAIL_BUCKET).remove([previousPath]);
      return json({ path: storagePath, token: data.token });
    }
    if (path[3] === 'submit') {
      if (['draft', 'rejected'].includes(ad.state)) {
        const stagingPath = `${user.id}/${ad.id}/image-staging`;
        if (ad.thumbnail_path === stagingPath && !ad.thumbnail_verified) {
          // The bytes are checked and copied to a new immutable object, so a
          // still-valid staging token can never replace a submitted image.
          const { data: file, error: fileError } = await db.storage
            .from(THUMBNAIL_BUCKET)
            .download(stagingPath);
          dbError(fileError);
          if (!file || file.size === 0 || file.size > MAX_THUMBNAIL_BYTES)
            throw new HttpError(400, 'Upload a valid image under 10 MB.');
          const bytes = new Uint8Array(await file.arrayBuffer());
          const meta = thumbnailMetadata(bytes);
          if (!meta || meta.width < 240 || meta.height < 240)
            throw new HttpError(
              400,
              'Upload a valid image at least 240 pixels per side.',
            );
          const extension =
            meta.mime === 'image/jpeg'
              ? 'jpg'
              : meta.mime === 'image/png'
                ? 'png'
                : 'webp';
          const verifiedPath = `${user.id}/${ad.id}/verified-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await db.storage
            .from(THUMBNAIL_BUCKET)
            .upload(verifiedPath, bytes, {
              cacheControl: '31536000',
              contentType: meta.mime,
              upsert: false,
            });
          dbError(uploadError);
          const { data: changed, error: updateError } = await db
            .from('bought_ads')
            .update({ thumbnail_path: verifiedPath, thumbnail_verified: true })
            .eq('id', ad.id)
            .eq('thumbnail_path', stagingPath)
            .eq('thumbnail_verified', false)
            .in('state', ['draft', 'rejected'])
            .select('id');
          if (updateError || !changed?.length) {
            await db.storage.from(THUMBNAIL_BUCKET).remove([verifiedPath]);
            dbError(updateError);
            throw new HttpError(409, 'The image changed. Refresh and try again.');
          }
          await db.storage.from(THUMBNAIL_BUCKET).remove([stagingPath]);
        }
      }
      const { error } = await db.rpc('bought_ad_submit', { p_ad_id: ad.id });
      dbError(error);
      return json({ submitted: true });
    }
    throw new HttpError(404, 'Not found.');
  }

  if (exactPath(path, 'ads', 'bid')) {
    if (!validDate(body.issue) || !SPOTS.includes(String(body.spot)))
      throw new HttpError(400, 'Check your bid and try again.');
    const points = Number(body.max);
    if (!Number.isSafeInteger(points) || points <= 0)
      throw new HttpError(400, 'Bids are whole points.');
    const { data, error } = await db.rpc('bought_ad_bid', {
      p_user: user.id,
      p_issue: body.issue,
      p_spot: body.spot,
      p_mode: body.mode === 'auto' ? 'auto' : 'exact',
      p_max_minor: points * 100,
      p_ad_id: validUuid(body.adId) ? body.adId : null,
    });
    dbError(error);
    return json(data);
  }

  if (exactPath(path, 'ads', 'bid-ad')) {
    if (!validDate(body.issue) || !SPOTS.includes(String(body.spot)))
      throw new HttpError(400, 'Check your ad and try again.');
    const ad = await ownedAd(body.adId, user.id);
    if (ad.spot !== body.spot)
      throw new HttpError(400, 'That ad does not fit this spot.');
    const { error } = await db
      .from('bought_ad_bids')
      .update({ ad_id: ad.id })
      .eq('issue', body.issue)
      .eq('spot', body.spot)
      .eq('user_id', user.id);
    dbError(error);
    return json({ saved: true });
  }

  if (exactPath(path, 'ads', 'topup')) {
    // points cost $1 each; GST (India) is added to the price, never to the points
    const points = Number(body.amount);
    if (!validUuid(body.id) || !Number.isSafeInteger(points) || points < 10 || points > 100000)
      throw new HttpError(400, 'Buy at least 10 points at a time.');
    const { data: acct, error: acctError } = await db
      .from('bought_accounts')
      .select('country')
      .eq('user_id', user.id)
      .maybeSingle();
    dbError(acctError);
    if (!acct) throw new HttpError(400, 'Add your business details first.');
    const gst = acct.country === 'India' ? 0.18 : 0;
    const method = body.method === 'card' ? 'card' : 'upi';
    const provider = method === 'card' ? 'stripe' : 'razorpay';
    if (!configuredProviders()[provider])
      throw new HttpError(
        503,
        method === 'card'
          ? 'Card payments are not available yet.'
          : 'UPI payments are not available yet.',
      );
    // UPI only settles in rupees, so Razorpay charges INR at the rate you set. Stripe charges USD.
    let charge = Math.round(points * 100 * (1 + gst));
    let currency: 'USD' | 'INR' = 'USD';
    if (provider === 'razorpay') {
      const rate = Number(required('USD_INR_RATE'));
      if (!Number.isFinite(rate) || rate <= 0)
        throw new HttpError(503, 'UPI payments are not available yet.');
      charge = Math.round(points * rate * 100 * (1 + gst));
      currency = 'INR';
    }
    const { error } = await db.from('bought_topups').insert({
      id: body.id,
      user_id: user.id,
      credit_minor: points * 100,
      tax_minor: Math.round(points * 100 * gst),
      charge_minor: charge,
      charge_currency: currency,
      provider,
      method,
    });
    if (error && error.code !== '23505') dbError(error);
    const load = async () => {
      const { data, error: readError } = await db
        .from('bought_topups')
        .select('*')
        .eq('id', body.id as string)
        .eq('user_id', user.id)
        .maybeSingle();
      dbError(readError);
      if (!data) throw new HttpError(404, 'Top-up not found.');
      return data as Topup & { payment_reference: string | null; checkout_url: string | null };
    };
    const { data: claimed, error: claimError } = await db.rpc(
      'bought_ad_claim_checkout',
      { p_topup_id: body.id },
    );
    dbError(claimError);
    if (claimed) {
      const checkout = await createCheckout(await load());
      const { error: saveError } = await db
        .from('bought_topups')
        .update({
          payment_reference: checkout.reference,
          checkout_url: checkout.url,
          checkout_state: 'ready',
          checkout_claimed_at: null,
        })
        .eq('id', body.id as string);
      dbError(saveError);
    }
    const current = await load();
    if (
      !validProviderReference(current.payment_reference) ||
      (current.provider === 'stripe' &&
        !trustedStripeCheckoutUrl(current.checkout_url))
    )
      throw new HttpError(503, 'Checkout is temporarily unavailable.');
    return json({
      provider: current.provider,
      url: current.checkout_url,
      orderId: current.payment_reference,
      amount: current.charge_minor,
      currency: current.charge_currency,
      email: user.email,
      key: current.provider === 'razorpay' ? required('RAZORPAY_KEY_ID') : undefined,
    });
  }

  if (exactPath(path, 'ads', 'withdraw')) {
    const points = Number(body.amount);
    if (!Number.isFinite(points) || points <= 0)
      throw new HttpError(400, 'Choose how many points to withdraw.');
    const { data, error } = await db.rpc('bought_ad_withdraw', {
      p_user: user.id,
      p_amount: Math.round(points * 100),
    });
    dbError(error);
    return json({ withdrawn: Number(data) / 100 });
  }

  throw new HttpError(404, 'Not found.');
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
      return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });

    if (exactPath(path, 'config') && method === 'GET')
      return json({
        live: isLive(),
        supabaseUrl: setting('SUPABASE_URL') ?? null,
        supabaseKey: setting('SUPABASE_PUBLISHABLE_KEY') ?? null,
        providers: configuredProviders(),
      });
    if (path[0] === 'admin' && !isDesk(request) && !exactPath(path, 'admin', 'status'))
      throw new HttpError(401, 'Unauthorized.');
    if (exactPath(path, 'admin', 'status')) {
      // Names only, never values. The password-protected desk shows what is left to connect.
      if (!isDesk(request) && setting('CRON_SECRET'))
        throw new HttpError(401, 'Unauthorized.');
      return json({ live: isLive(), missing: missingKeys(), providers: configuredProviders() });
    }
    if (!isLive())
      throw new HttpError(503, 'Advertising is not connected yet.');

    if (path[0] === 'webhooks' && method === 'POST' && path.length === 2) {
      await webhook(request, path[1]);
      return json({ received: true });
    }
    if (exactPath(path, 'cron') && (method === 'GET' || method === 'POST')) {
      if (!isDesk(request)) throw new HttpError(401, 'Unauthorized.');
      return json(await tick());
    }
    if (path[0] === 'admin') return await admin(request, path);

    if (exactPath(path, 'ads', 'market') && method === 'GET') {
      const user = await maybeIdentity(request);
      return json(await market(user?.id ?? null));
    }
    if (exactPath(path, 'ads', 'winners') && method === 'GET') {
      const issue = url.searchParams.get('date');
      if (!validDate(issue)) throw new HttpError(400, 'Invalid issue date.');
      const { data, error } = await database().rpc('bought_ad_winners', {
        p_issue: issue,
      });
      dbError(error);
      const winners = await Promise.all(
        (data ?? []).map(async (w: Record<string, unknown>) => {
          const { image, ...rest } = w;
          return { ...rest, signedImage: await signedImage(image as string | null) };
        }),
      );
      return json({ winners }, 200, {
        'Cache-Control': 'public, max-age=60',
      });
    }
    if (exactPath(path, 'ads', 'event') && method === 'POST') {
      sameOrigin(request);
      const body = await jsonBody(request);
      if (
        !validDate(body.issue) ||
        !SPOTS.includes(String(body.spot)) ||
        !['view', 'play', 'click'].includes(String(body.kind))
      )
        throw new HttpError(400, 'Invalid event.');
      await rateLimit(`event:${clientAddress(request)}`, 120, 60);
      const { error } = await database().rpc('bought_ad_count', {
        p_issue: body.issue,
        p_spot: body.spot,
        p_kind: body.kind,
      });
      dbError(error);
      return json({ counted: true });
    }
    if (path[0] === 'media' && method === 'GET' && path.length === 2) {
      if (!validUuid(path[1])) throw new HttpError(400, 'Invalid ad ID.');
      const db = database();
      const { data: ad, error } = await db
        .from('bought_ads')
        .select('id,user_id,mux_playback_id,thumbnail_path')
        .eq('id', path[1])
        .maybeSingle();
      dbError(error);
      if (!ad) throw new HttpError(404, 'Ad not found.');
      const { data: isPublic, error: publicError } = await db.rpc(
        'bought_ad_public_media',
        { p_ad_id: ad.id },
      );
      dbError(publicError);
      if (!isPublic) {
        const user = await identity(request);
        if (ad.user_id !== user.id) throw new HttpError(404, 'Ad not found.');
      }
      if (!ad.mux_playback_id)
        throw new HttpError(409, 'This video is still processing.');
      return json({
        playbackId: ad.mux_playback_id,
        token: muxPlaybackToken(ad.mux_playback_id),
        poster: await signedImage(ad.thumbnail_path),
      });
    }
    if (path[0] === 'ads' && method === 'POST') return await advertiser(request, path);
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
      { error: 'Something went wrong. Your bid and ad are safe; please try again.' },
      500,
    );
  }
}
