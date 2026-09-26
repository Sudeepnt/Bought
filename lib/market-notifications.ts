import type { PublishedEntry } from './drop-domain';

export type MarketNotificationType = 'outbid' | 'leader';

export type MarketNotification = {
  id: string;
  type: MarketNotificationType;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt: string | null;
};

export type MarketNotificationDraft = Pick<
  MarketNotification,
  'type' | 'title' | 'body' | 'href'
>;

export type MarketNotificationSnapshot = {
  auctionId: string;
  phase?: 'bidding' | 'exposure';
  entries: Pick<
    PublishedEntry,
    'drop_id' | 'position' | 'category' | 'title'
  >[];
};

/** Build alerts from two snapshots. The first snapshot of an auction is only a baseline. */
export function marketNotificationEvents(
  previous: MarketNotificationSnapshot | null,
  current: MarketNotificationSnapshot,
  ownedDropIds: readonly string[] = [],
): MarketNotificationDraft[] {
  if (
    !previous ||
    previous.auctionId !== current.auctionId ||
    previous.phase === 'exposure' ||
    current.phase === 'exposure' ||
    previous.entries.length === 0 ||
    current.entries.length === 0
  )
    return [];

  const owned = new Set(ownedDropIds);
  const oldById = new Map(
    previous.entries.map((entry) => [entry.drop_id, entry]),
  );
  const nextById = new Map(
    current.entries.map((entry) => [entry.drop_id, entry]),
  );
  const events: MarketNotificationDraft[] = [];

  for (const [dropId, oldEntry] of oldById) {
    const nextEntry = nextById.get(dropId);
    if (
      !owned.has(dropId) ||
      !nextEntry ||
      nextEntry.position <= oldEntry.position
    )
      continue;

    events.push({
      type: 'outbid',
      title: 'You were outbid',
      body: `Your ${oldEntry.category} bid moved from #${oldEntry.position} to #${nextEntry.position}.`,
      href: '/broadcast',
    });
  }

  const oldLeader = previous.entries.find((entry) => entry.position === 1);
  const newLeader = current.entries.find((entry) => entry.position === 1);
  if (oldLeader && newLeader && oldLeader.drop_id !== newLeader.drop_id) {
    const isYourBid = owned.has(newLeader.drop_id);
    const isNewBid = !oldById.has(newLeader.drop_id);
    events.push({
      type: 'leader',
      title: isYourBid
        ? 'You took #1'
        : isNewBid
          ? 'A new bidder took #1'
          : 'The #1 position changed',
      body: isYourBid
        ? `Your ${newLeader.category} bid just moved into the top spot.`
        : isNewBid
          ? `“${newLeader.title}” is now #1 in ${newLeader.category}.`
          : `“${newLeader.title}” moved into #1 in ${newLeader.category}.`,
      href: '/categories',
    });
  }

  return events;
}

export function notificationStorageKey(accountId: string) {
  return `bought-market-notifications:${accountId}`;
}

export function browserNotificationPreferenceKey(accountId: string) {
  return `bought-browser-notifications:${accountId}`;
}

export function readStoredNotifications(
  value: string | null,
): MarketNotification[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMarketNotification).slice(0, 50);
  } catch {
    return [];
  }
}

function isMarketNotification(value: unknown): value is MarketNotification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MarketNotification>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.type === 'outbid' || candidate.type === 'leader') &&
    typeof candidate.title === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.href === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.readAt === null || typeof candidate.readAt === 'string')
  );
}
