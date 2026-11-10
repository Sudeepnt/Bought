// Ad videos in Cloudflare R2. R2 speaks the S3 API; this signs its links with AWS Signature V4 using node:crypto.
// The browser gets only short-lived links for one object and one method: a PUT for its own upload, a GET to play
// a video it may see. The secret key never leaves this server.
import { execFile } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '../drop-domain';
import { HttpError, required } from './config';

export const UPLOAD_SECONDS = 2 * 60 * 60;
export const PLAY_SECONDS = 10 * 60;
const KEY = /^ads\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm)$/;

// What a browser may upload, and how it is stored. A .mov is the same container family as MP4 and is stored as one.
const TYPES: Record<string, { ext: 'mp4' | 'webm'; type: string }> = {
  'video/mp4': { ext: 'mp4', type: 'video/mp4' },
  'video/quicktime': { ext: 'mp4', type: 'video/mp4' },
  'video/x-m4v': { ext: 'mp4', type: 'video/mp4' },
  'video/webm': { ext: 'webm', type: 'video/webm' },
};

export function storedType(browserType: unknown) {
  const base = typeof browserType === 'string' ? browserType.split(';', 1)[0].trim().toLowerCase() : '';
  return TYPES[base] ?? null;
}

export function typeOfKey(key: string) {
  return key.endsWith('.webm') ? 'video/webm' : 'video/mp4';
}

export function validVideoKey(key: unknown): key is string {
  return typeof key === 'string' && KEY.test(key);
}

export function newVideoKey(adId: string, ext: 'mp4' | 'webm') {
  return `ads/${adId}/${crypto.randomUUID()}.${ext}`;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
// RFC 3986, as SigV4 wants it: everything but unreserved characters is percent-encoded.
const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// AWS Signature V4 in the query string (a presigned link), for any S3-compatible host. Signed headers (here only
// content-type, for uploads) must be sent exactly as signed. Tested against AWS's published example.
export function signUrl({
  method,
  host,
  path,
  region,
  accessKey,
  secret,
  seconds,
  headers = {},
  now = new Date(),
}: {
  method: string;
  host: string;
  path: string;
  region: string;
  accessKey: string;
  secret: string;
  seconds: number;
  headers?: Record<string, string>;
  now?: Date;
}) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const signed: Record<string, string> = { host };
  for (const [name, value] of Object.entries(headers)) signed[name.toLowerCase()] = value.trim();
  const names = Object.keys(signed).sort();
  const query: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKey}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(Math.max(1, Math.min(Math.floor(seconds), 7 * 24 * 3600)))],
    ['X-Amz-SignedHeaders', names.join(';')],
  ];
  const qs = query
    .map(([k, v]) => [encode(k), encode(v)])
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const canonical = [
    method,
    path,
    qs,
    names.map((n) => `${n}:${signed[n]}\n`).join(''),
    names.join(';'),
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  return `https://${host}${path}?${qs}&X-Amz-Signature=${signature}`;
}

// A link to one ad video in the bucket, for one method, that stops working after `seconds`.
export function presign(
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE',
  key: string,
  seconds: number,
  headers: Record<string, string> = {},
  now = new Date(),
) {
  if (!validVideoKey(key)) throw new HttpError(400, 'Invalid video key.');
  const account = required('R2_ACCOUNT_ID');
  if (!/^[a-f0-9]{32}$/.test(account)) throw new HttpError(503, 'Video storage is not configured.');
  return signUrl({
    method,
    host: `${account}.r2.cloudflarestorage.com`,
    path: `/${encode(required('R2_BUCKET'))}/${key.split('/').map(encode).join('/')}`,
    region: 'auto',
    accessKey: required('R2_ACCESS_KEY_ID'),
    secret: required('R2_SECRET_ACCESS_KEY'),
    seconds,
    headers,
    now,
  });
}

export async function headVideo(key: string) {
  const response = await fetch(presign('HEAD', key, 60), {
    method: 'HEAD',
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new HttpError(502, 'Video storage could not be reached. Try again shortly.');
  return {
    size: Number(response.headers.get('content-length') ?? 0),
    type: (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase(),
  };
}

export async function deleteVideo(key: string) {
  const response = await fetch(presign('DELETE', key, 60), {
    method: 'DELETE',
    signal: AbortSignal.timeout(20000),
  });
  if (response.ok || response.status === 404) return;
  throw new HttpError(502, 'Video storage could not remove an old recording.');
}

type Probe = {
  format?: { duration?: string };
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
};

// Video and sound codecs every current browser plays without help. Anything else would play for some readers only.
const VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1']);
const AUDIO_CODECS = new Set(['aac', 'opus', 'mp3', 'vorbis']);
export const NOT_PLAYABLE =
  'Your video needs a picture at least 240 pixels each way, a sound track and a length from 1 second to 10 minutes, as MP4 (H.264) or WebM. Record here, or export it again and upload.';

export function judgeProbe(probe: Probe | null, size: number) {
  if (!(size > 0) || size > MAX_VIDEO_BYTES) return 'Your video must be under 500 MB. Export it at a lower quality and try again.';
  if (!probe) return NOT_PLAYABLE;
  const duration = Number(probe.format?.duration);
  const streams = probe.streams ?? [];
  const picture = streams.some(
    (s) =>
      s.codec_type === 'video' &&
      VIDEO_CODECS.has(String(s.codec_name)) &&
      (s.width ?? 0) >= 240 &&
      (s.height ?? 0) >= 240,
  );
  const sound = streams.some((s) => s.codec_type === 'audio' && AUDIO_CODECS.has(String(s.codec_name)));
  // A browser recording (WebM from MediaRecorder) often carries no duration; the page limits those takes itself.
  const length = !Number.isFinite(duration) || (duration >= 1 && duration <= MAX_VIDEO_SECONDS + 1);
  return picture && sound && length ? null : NOT_PLAYABLE;
}

// ffprobe reads only what it needs over a short-lived signed GET; the file is never downloaded here.
export function probeVideo(key: string): Promise<Probe | null> {
  const url = presign('GET', key, 300);
  return new Promise((resolve) => {
    execFile(
      process.env.FFPROBE || 'ffprobe',
      [
        '-v', 'error',
        '-protocol_whitelist', 'https,tls,tcp',
        '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height',
        '-of', 'json',
        url,
      ],
      { timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          resolve(JSON.parse(stdout) as Probe);
        } catch {
          resolve(null);
        }
      },
    );
  });
}
