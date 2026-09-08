export async function hmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function constantEqual(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}

export async function verifyWebhook(
  raw: string,
  header: string | null,
  secret: string,
  timestamped: boolean,
  now = Date.now(),
) {
  if (!header) return false;
  if (!timestamped)
    return (
      /^[a-f\d]{64}$/i.test(header) &&
      constantEqual(await hmac(secret, raw), header)
    );
  const fields = header.split(',').map((part) => part.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 't');
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1])) return false;
  const timestamp = timestamps[0][1];
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = await hmac(secret, `${timestamp}.${raw}`);
  return fields.some(
    ([key, value]) =>
      key === 'v1' &&
      /^[a-f\d]{64}$/i.test(value) &&
      constantEqual(expected, value),
  );
}
