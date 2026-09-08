export const CATEGORIES = [
  'BEEF',
  'CHAOS',
  'UNPOPULAR OPINION',
  'I WAS WRONG',
  'THE RANT',
  'CONFESSIONS',
  'MONEY I SET ON FIRE',
  'THE PITCH THAT GOT REJECTED',
  'BUILDING',
  'THE ASK',
  'HIRING',
  'AGENCY ROW',
  'INDIAN D2C',
] as const;

export const MIN_BID_MINOR = 10_000;
export const MAX_BID_MINOR = 100_000_000;
export const MAX_VIDEO_SECONDS = 120;
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
export const THUMBNAIL_BUCKET = 'drop-thumbnails';
export type PaymentProvider = 'stripe' | 'razorpay';
export type Drop = {
  id: string;
  category: string;
  title: string;
  amount_minor: number;
  currency: 'USD';
  provider: PaymentProvider;
  payment_state: 'unpaid' | 'paid' | 'refunded' | 'disputed';
  checkout_state: 'new' | 'creating' | 'ready';
  payment_reference: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  state: 'draft' | 'processing' | 'review' | 'rejected' | 'published';
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  media_state: 'none' | 'waiting' | 'processing' | 'ready' | 'errored';
  thumbnail_path: string | null;
  thumbnail_verified: boolean;
  submitted_at: string | null;
  review_reason: string | null;
  auction_id: string | null;
  exposure_starts_at: string | null;
  exposure_ends_at: string | null;
  created_at: string;
};
export type Market = {
  auctionId: string;
  serverNow: string;
  opensAt: string;
  closesAt: string;
  exposureEndsAt: string;
  phase: 'bidding' | 'exposure';
  configured: boolean;
};
export type LadderEntry = {
  drop_id: string;
  position: number;
  category: string;
  title: string;
  amount_minor: number;
  published_at: string;
  exposure_ends_at: string;
};

export function money(amountMinor: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export function parseBid(value: string): number {
  // Decimal arithmetic is deliberately avoided: the ladder uses whole dollars.
  if (!/^\d{1,7}$/.test(value)) throw new Error('Enter a whole dollar amount.');
  const amount = Number(value) * 100;
  if (amount < MIN_BID_MINOR || amount > MAX_BID_MINOR)
    throw new Error('Your bid must be between $100 and $1,000,000.');
  return amount;
}

export function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function thumbnailMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return 'image/png';
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export function validMedia(asset: {
  duration?: number;
  tracks?: { type: string; max_width?: number; max_height?: number }[];
}) {
  return (
    Number.isFinite(asset.duration) &&
    asset.duration! >= 1 &&
    asset.duration! <= MAX_VIDEO_SECONDS + 1 &&
    !!asset.tracks?.some(
      (t) =>
        t.type === 'video' &&
        (t.max_width ?? 0) >= 240 &&
        (t.max_height ?? 0) >= 240,
    ) &&
    !!asset.tracks?.some((t) => t.type === 'audio')
  );
}
