import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
  type VapidKeys,
} from '@block65/webcrypto-web-push';
import { HttpError, setting } from './config';
import { database, dbError } from './security';

type PushEvent = {
  id: number;
  user_id: string;
  kind: 'outbid' | 'leader';
  title: string;
  body: string;
  href: string;
};

const trustedPushHosts = [
  (host: string) => host === 'push.apple.com' || host.endsWith('.push.apple.com'),
  (host: string) => host === 'fcm.googleapis.com',
  (host: string) =>
    host === 'updates.push.services.mozilla.com' ||
    host === 'push.services.mozilla.com',
  (host: string) => host.endsWith('.notify.windows.com'),
  (host: string) => host.endsWith('.pns.windows.com'),
];

function vapidKeys(): VapidKeys | null {
  const subject = setting('VAPID_SUBJECT') ?? setting('APP_ORIGIN');
  const publicKey = setting('VAPID_PUBLIC_KEY');
  const privateKey = setting('VAPID_PRIVATE_KEY');
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export function pushPublicKey() {
  return vapidKeys()?.publicKey ?? null;
}

export function isTrustedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      trustedPushHosts.some((accepts) => accepts(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

function validBase64Url(value: unknown, expectedBytes: number) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length > 128
  )
    return false;
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const decoded = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return decoded.length === expectedBytes;
  } catch {
    return false;
  }
}

function parseSubscription(value: unknown): WebPushSubscription {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'The push subscription is invalid.');
  const candidate = value as {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const expirationTime = candidate.expirationTime;
  if (
    !isTrustedPushEndpoint(candidate.endpoint) ||
    !candidate.keys ||
    !validBase64Url(candidate.keys.p256dh, 65) ||
    !validBase64Url(candidate.keys.auth, 16) ||
    (expirationTime !== null &&
      (typeof expirationTime !== 'number' ||
        !Number.isFinite(expirationTime) ||
        expirationTime < 0 ||
        expirationTime > 8.64e15))
  )
    throw new HttpError(400, 'The push subscription is invalid.');
  return {
    endpoint: candidate.endpoint,
    expirationTime: expirationTime as number | null,
    keys: {
      p256dh: candidate.keys.p256dh as string,
      auth: candidate.keys.auth as string,
    },
  };
}

function requirePushSetup() {
  const keys = vapidKeys();
  if (!keys)
    throw new HttpError(
      503,
      'Phone alerts need VAPID push keys configured on the BOUGHT server.',
    );
  return keys;
}

export async function savePushSubscription(userId: string, value: unknown) {
  requirePushSetup();
  const subscription = parseSubscription(value);
  const db = database();
  const { count, error: countError } = await db
    .from('bought_push_subscriptions')
    .select('endpoint', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('endpoint', subscription.endpoint);
  dbError(countError);
  if ((count ?? 0) >= 5)
    throw new HttpError(
      409,
      'This account already has alerts on five devices. Turn alerts off on one device first.',
    );
  const { error } = await db.from('bought_push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      expiration_time:
        subscription.expirationTime === null
          ? null
          : new Date(subscription.expirationTime).toISOString(),
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  dbError(error);
}

export async function deletePushSubscription(userId: string, endpoint: unknown) {
  if (!isTrustedPushEndpoint(endpoint))
    throw new HttpError(400, 'The push subscription is invalid.');
  const { error } = await database()
    .from('bought_push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  dbError(error);
}

async function sendPush(
  subscription: WebPushSubscription,
  event: { id: string; kind: string; title: string; body: string; href: string },
  vapid: VapidKeys,
) {
  const request = await buildPushPayload(
    { data: JSON.stringify(event), options: { ttl: 300, urgency: 'high' } },
    subscription,
    vapid,
  );
  return fetch(subscription.endpoint, {
    ...request,
    signal: AbortSignal.timeout(5000),
  });
}

async function removeExpiredSubscription(endpoint: string) {
  const { error } = await database()
    .from('bought_push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  dbError(error);
}

export async function sendPushTest(userId: string) {
  const vapid = requirePushSetup();
  const db = database();
  const { data, error } = await db
    .from('bought_push_subscriptions')
    .select('endpoint,expiration_time,p256dh,auth,user_id')
    .eq('user_id', userId);
  dbError(error);
  const subscriptions = (data ?? []) as Array<{
    endpoint: string;
    expiration_time: string | null;
    p256dh: string;
    auth: string;
    user_id: string;
  }>;
  if (!subscriptions.length)
    throw new HttpError(404, 'Enable phone alerts on this device first.');

  let delivered = 0;
  for (const stored of subscriptions) {
    if (!isTrustedPushEndpoint(stored.endpoint)) continue;
    const subscription: WebPushSubscription = {
      endpoint: stored.endpoint,
      expirationTime: stored.expiration_time
        ? Date.parse(stored.expiration_time)
        : null,
      keys: { p256dh: stored.p256dh, auth: stored.auth },
    };
    try {
      const response = await sendPush(
        subscription,
        {
          id: `test:${crypto.randomUUID()}`,
          kind: 'test',
          title: 'BOUGHT alerts are on',
          body: 'You’ll get market alerts here, even when BOUGHT is closed.',
          href: '/categories',
        },
        vapid,
      );
      if (response.status === 404 || response.status === 410) {
        await removeExpiredSubscription(stored.endpoint);
      } else if (response.ok) {
        delivered += 1;
      }
    } catch {
      // Another device can still receive the test if one push service is unavailable.
    }
  }
  if (!delivered)
    throw new HttpError(503, 'The push service did not accept the test alert.');
}

export async function flushMarketPushEvents() {
  const vapid = vapidKeys();
  if (!vapid) return;
  const db = database();
  const { data: claimed, error: claimError } = await db.rpc(
    'bought_claim_push_events',
    { p_limit: 25 },
  );
  dbError(claimError);
  const events = (claimed ?? []) as PushEvent[];
  if (!events.length) return;

  const userIds = [...new Set(events.map((event) => event.user_id))];
  const { data, error } = await db
    .from('bought_push_subscriptions')
    .select('endpoint,expiration_time,p256dh,auth,user_id')
    .in('user_id', userIds);
  if (error) {
    await releaseEvents(events.map((event) => event.id));
    dbError(error);
  }
  const byUser = new Map<string, typeof data>();
  for (const subscription of data ?? []) {
    const subscriptions = byUser.get(subscription.user_id) ?? [];
    subscriptions.push(subscription);
    byUser.set(subscription.user_id, subscriptions);
  }

  const delivered: number[] = [];
  const retry: number[] = [];
  const expired: string[] = [];
  let sends = 0;
  for (const event of events) {
    const subscriptions = byUser.get(event.user_id) ?? [];
    if (!subscriptions.length) {
      delivered.push(event.id);
      continue;
    }
    if (sends + subscriptions.length > 25) {
      retry.push(event.id);
      continue;
    }
    sends += subscriptions.length;
    let eventDelivered = true;
    for (const stored of subscriptions) {
      if (!isTrustedPushEndpoint(stored.endpoint)) {
        expired.push(stored.endpoint);
        continue;
      }
      const subscription: WebPushSubscription = {
        endpoint: stored.endpoint,
        expirationTime: stored.expiration_time
          ? Date.parse(stored.expiration_time)
          : null,
        keys: { p256dh: stored.p256dh, auth: stored.auth },
      };
      try {
        const response = await sendPush(
          subscription,
          {
            id: `market:${event.id}`,
            kind: event.kind,
            title: event.title,
            body: event.body,
            href: event.href,
          },
          vapid,
        );
        if (response.status === 404 || response.status === 410) {
          expired.push(stored.endpoint);
        } else if (!response.ok) {
          eventDelivered = false;
        }
      } catch {
        eventDelivered = false;
      }
    }
    (eventDelivered ? delivered : retry).push(event.id);
  }

  if (expired.length) {
    const { error: deleteError } = await db
      .from('bought_push_subscriptions')
      .delete()
      .in('endpoint', [...new Set(expired)]);
    dbError(deleteError);
  }
  if (delivered.length) {
    const { error: deliveredError } = await db
      .from('bought_push_events')
      .update({ delivered_at: new Date().toISOString(), claimed_until: null })
      .in('id', delivered);
    dbError(deliveredError);
  }
  if (retry.length) await releaseEvents(retry);
}

async function releaseEvents(ids: number[]) {
  if (!ids.length) return;
  const { error } = await database()
    .from('bought_push_events')
    .update({ claimed_until: null })
    .in('id', ids);
  dbError(error);
}
