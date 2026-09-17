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

export type CaptureMode = 'camera' | 'screen';

export const TALK_ONLY_CATEGORIES = [
  'BEEF',
  'CHAOS',
  'UNPOPULAR OPINION',
  'I WAS WRONG',
  'THE RANT',
  'CONFESSIONS',
] as const satisfies readonly (typeof CATEGORIES)[number][];

export function captureModeForCategory(category: string): CaptureMode {
  return (TALK_ONLY_CATEGORIES as readonly string[]).includes(category)
    ? 'camera'
    : 'screen';
}

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
  capture_mode: CaptureMode;
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
export type PublishedEntry = {
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
  // Decimal arithmetic is deliberately avoided: bids use whole dollars.
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

type ThumbnailMetadata = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
};

function uint16be(bytes: Uint8Array, offset: number) {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function uint24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
}

function uint32be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 16777216 +
    bytes[offset + 1] * 65536 +
    bytes[offset + 2] * 256 +
    bytes[offset + 3]
  );
}

function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) return null;
    const length = uint16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (startOfFrame.has(marker)) {
      if (length < 7) return null;
      return {
        width: uint16be(bytes, offset + 5),
        height: uint16be(bytes, offset + 3),
      };
    }
    offset += length;
  }
  return null;
}

export function thumbnailMetadata(bytes: Uint8Array): ThumbnailMetadata | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const dimensions = jpegDimensions(bytes);
    return dimensions ? { mime: 'image/jpeg', ...dimensions } : null;
  }
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n) &&
    new TextDecoder().decode(bytes.slice(12, 16)) === 'IHDR'
  ) {
    return {
      mime: 'image/png',
      width: uint32be(bytes, 16),
      height: uint32be(bytes, 20),
    };
  }
  if (
    bytes.length >= 30 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  ) {
    const format = new TextDecoder().decode(bytes.slice(12, 16));
    if (format === 'VP8X')
      return {
        mime: 'image/webp',
        width: uint24le(bytes, 24) + 1,
        height: uint24le(bytes, 27) + 1,
      };
    if (
      format === 'VP8 ' &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    )
      return {
        mime: 'image/webp',
        width: (bytes[26] + bytes[27] * 256) & 0x3fff,
        height: (bytes[28] + bytes[29] * 256) & 0x3fff,
      };
    if (format === 'VP8L' && bytes[20] === 0x2f)
      return {
        mime: 'image/webp',
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height:
          1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      };
  }
  return null;
}

export function thumbnailMime(bytes: Uint8Array): string | null {
  return thumbnailMetadata(bytes)?.mime ?? null;
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
