import { createClient } from '@supabase/supabase-js';
import { HttpError, origin, required } from './config';

export function database() {
  return createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function identity(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    throw new HttpError(401, 'Sign in to continue.');
  const { data, error } = await database().auth.getUser(authorization.slice(7));
  if (
    error ||
    !data.user ||
    !data.user.email_confirmed_at ||
    data.user.is_anonymous
  )
    throw new HttpError(401, 'Please sign in again.');
  return data.user;
}

export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== origin())
    throw new HttpError(403, 'Request origin was not accepted.');
}

export async function rateLimit(key: string, limit = 30, seconds = 60) {
  // INCR and expiry are atomic; a missing limiter fails closed for writes.
  const response = await fetch(required('UPSTASH_REDIS_REST_URL'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${required('UPSTASH_REDIS_REST_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      'EVAL',
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      '1',
      `bought:${key}`,
      String(seconds),
    ]),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json()) as { result?: number; error?: string };
  if (!response.ok || body.error || typeof body.result !== 'number')
    throw new HttpError(503, 'Please try again in a moment.');
  if (body.result > limit)
    throw new HttpError(
      429,
      'Too many attempts. Please wait a minute and try again.',
    );
}

export async function readBody(request: Request, max = 65536): Promise<string> {
  if (Number(request.headers.get('content-length')) > max)
    throw new HttpError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

export function dbError(error: { message: string } | null) {
  if (error)
    throw new HttpError(
      409,
      error.message.includes('BOUGHT:')
        ? error.message.split('BOUGHT:')[1].trim()
        : 'This broadcast changed. Refresh and try again.',
    );
}

export { constantEqual, hmac, verifyWebhook } from '../webhook-signatures';
