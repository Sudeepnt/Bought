import assert from 'node:assert/strict';
import test from 'node:test';

import {
  directMessageThreadId,
  parseDirectMessageThreads,
} from '../lib/direct-messages';

test('direct-message thread IDs normalize public handles', () => {
  assert.equal(directMessageThreadId('@AnanyaBuilds'), 'contact:ananyabuilds');
  assert.equal(directMessageThreadId('  @ARJUNSAYS  '), 'contact:arjunsays');
});

test('stored direct messages are validated and sorted by recency', () => {
  const threads = parseDirectMessageThreads(
    JSON.stringify([
      {
        id: 'contact:older',
        contact: {
          id: 'older',
          name: 'Older Person',
          handle: '@older',
          initials: 'OP',
        },
        context: {
          broadcastId: 'broadcast-1',
          broadcastTitle: 'Older broadcast',
          categoryName: 'BEEF',
        },
        messages: [
          {
            id: 'message-1',
            body: 'First message',
            sentAt: '2026-09-19T10:00:00.000Z',
            direction: 'outgoing',
          },
        ],
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
      { id: 'invalid-thread' },
      {
        id: 'contact:newer',
        contact: {
          id: 'newer',
          name: 'Newer Person',
          handle: '@newer',
          initials: 'NP',
        },
        context: {
          broadcastId: 'broadcast-2',
          broadcastTitle: 'Newer broadcast',
          categoryName: 'BUILDING',
        },
        messages: [
          {
            id: 'message-2',
            body: 'Most recent message',
            sentAt: '2026-09-20T10:00:00.000Z',
            direction: 'outgoing',
          },
        ],
        updatedAt: '2026-09-20T10:00:00.000Z',
      },
    ]),
  );

  assert.deepEqual(
    threads.map((thread) => thread.id),
    ['contact:newer', 'contact:older'],
  );
  assert.equal(threads[0].messages[0].body, 'Most recent message');
});

