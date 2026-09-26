import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  marketNotificationEvents,
  notificationStorageKey,
  readStoredNotifications,
  type MarketNotificationSnapshot,
} from '../lib/market-notifications';

const previous: MarketNotificationSnapshot = {
  auctionId: '2026-09-23',
  entries: [
    { drop_id: 'leader', position: 1, category: 'BEEF', title: 'First take' },
    { drop_id: 'owned', position: 2, category: 'CHAOS', title: 'My take' },
    {
      drop_id: 'third',
      position: 3,
      category: 'BUILDING',
      title: 'Third take',
    },
  ],
};

void test('market changes notify an owner when their position slips and a new bid takes #1', () => {
  const current: MarketNotificationSnapshot = {
    auctionId: '2026-09-23',
    entries: [
      {
        drop_id: 'new-leader',
        position: 1,
        category: 'THE ASK',
        title: 'A better question',
      },
      { drop_id: 'leader', position: 2, category: 'BEEF', title: 'First take' },
      { drop_id: 'owned', position: 3, category: 'CHAOS', title: 'My take' },
      {
        drop_id: 'third',
        position: 4,
        category: 'BUILDING',
        title: 'Third take',
      },
    ],
  };

  assert.deepEqual(marketNotificationEvents(previous, current, ['owned']), [
    {
      type: 'outbid',
      title: 'You were outbid',
      body: 'Your CHAOS bid moved from #2 to #3.',
      href: '/broadcast',
    },
    {
      type: 'leader',
      title: 'A new bidder took #1',
      body: '“A better question” is now #1 in THE ASK.',
      href: '/categories',
    },
  ]);
});

void test('the owner is told when their own bid takes the top spot', () => {
  const current: MarketNotificationSnapshot = {
    auctionId: previous.auctionId,
    entries: [
      { drop_id: 'owned', position: 1, category: 'CHAOS', title: 'My take' },
      { drop_id: 'leader', position: 2, category: 'BEEF', title: 'First take' },
      {
        drop_id: 'third',
        position: 3,
        category: 'BUILDING',
        title: 'Third take',
      },
    ],
  };

  assert.deepEqual(marketNotificationEvents(previous, current, ['owned']), [
    {
      type: 'leader',
      title: 'You took #1',
      body: 'Your CHAOS bid just moved into the top spot.',
      href: '/categories',
    },
  ]);
});

void test('an existing bidder taking #1 is not described as a new bidder', () => {
  const current: MarketNotificationSnapshot = {
    auctionId: previous.auctionId,
    entries: [
      {
        drop_id: 'third',
        position: 1,
        category: 'BUILDING',
        title: 'Third take',
      },
      { drop_id: 'leader', position: 2, category: 'BEEF', title: 'First take' },
      { drop_id: 'owned', position: 3, category: 'CHAOS', title: 'My take' },
    ],
  };

  const events = marketNotificationEvents(previous, current, ['owned']);
  assert.equal(events.at(-1)?.title, 'The #1 position changed');
  assert.equal(events.at(-1)?.body, '“Third take” moved into #1 in BUILDING.');
});

void test('initial snapshots, auction rollovers, and unchanged rankings do not alert', () => {
  assert.deepEqual(marketNotificationEvents(null, previous, ['owned']), []);
  assert.deepEqual(
    marketNotificationEvents(
      previous,
      { ...previous, auctionId: '2026-09-24' },
      ['owned'],
    ),
    [],
  );
  assert.deepEqual(marketNotificationEvents(previous, previous, ['owned']), []);
});

void test('rank changes do not claim a visitor was outbid unless they own the position', () => {
  const current: MarketNotificationSnapshot = {
    auctionId: previous.auctionId,
    entries: [
      { drop_id: 'leader', position: 1, category: 'BEEF', title: 'First take' },
      { drop_id: 'new', position: 2, category: 'THE ASK', title: 'A new take' },
      { drop_id: 'owned', position: 3, category: 'CHAOS', title: 'My take' },
      {
        drop_id: 'third',
        position: 4,
        category: 'BUILDING',
        title: 'Third take',
      },
    ],
  };

  const events = marketNotificationEvents(previous, current);
  assert.equal(
    events.some((event) => event.type === 'outbid'),
    false,
  );
});

void test('notification storage parsing ignores malformed data and caps saved history', () => {
  assert.deepEqual(readStoredNotifications('not json'), []);
  assert.deepEqual(readStoredNotifications('[]'), []);
  assert.equal(
    notificationStorageKey('user-123'),
    'bought-market-notifications:user-123',
  );

  const history = Array.from({ length: 55 }, (_, index) => ({
    id: `notification-${index}`,
    type: 'leader',
    title: 'A new bidder took #1',
    body: 'A title moved into the top spot.',
    href: '/categories',
    createdAt: '2026-09-23T00:00:00.000Z',
    readAt: null,
  }));
  assert.equal(readStoredNotifications(JSON.stringify(history)).length, 50);
});
