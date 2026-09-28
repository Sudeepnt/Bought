import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RECORDING_RETENTION_MS,
  recordingExpiryLabel,
  recordingRetention,
  recordingSavedAt,
} from '../lib/recording-retention';

void test('unused recordings expire exactly fourteen days after saving', () => {
  const savedAt = Date.UTC(2026, 8, 1);
  const active = recordingRetention({
    savedAt,
    inUse: false,
    now: savedAt + RECORDING_RETENTION_MS - 1,
  });
  const expired = recordingRetention({
    savedAt,
    inUse: false,
    now: savedAt + RECORDING_RETENTION_MS,
  });
  assert.equal(active.expired, false);
  assert.equal(expired.expired, true);
  assert.equal(expired.progress, 100);
});

void test('submitted recordings stay available with their broadcast', () => {
  const retained = recordingRetention({
    savedAt: 0,
    inUse: true,
    now: RECORDING_RETENTION_MS * 3,
  });
  assert.equal(retained.expired, false);
  assert.equal(retained.inUse, true);
});

void test('upload target time resolves to the original save time', () => {
  const createdAt = '2026-09-01T00:00:00.000Z';
  assert.equal(
    recordingSavedAt({
      uploadExpiresAt: '2026-09-10T14:00:00.000Z',
      createdAt,
    }),
    Date.parse('2026-09-10T12:00:00.000Z'),
  );
  assert.equal(recordingSavedAt({ localSavedAt: 123, createdAt }), 123);
});

void test('expiry labels remain useful near the deadline', () => {
  assert.equal(recordingExpiryLabel(14 * 86400000), 'Expires in 14 days');
  assert.equal(recordingExpiryLabel(90 * 60000), 'Expires in 2 hours');
  assert.equal(recordingExpiryLabel(30000), 'Expires in 1 minute');
  assert.equal(recordingExpiryLabel(0), 'Expired');
});
