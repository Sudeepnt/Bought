import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNewReelWheelGesture } from '../lib/reel-wheel-gesture';

void test('one trackpad swipe burst advances only once', () => {
  const wheelEventTimes = [1000, 1080, 1210, 1430, 1600];
  let previousEventAt: number | null = null;
  const acceptedGestures = wheelEventTimes.filter((now) => {
    const isNewGesture = isNewReelWheelGesture(now, previousEventAt);
    previousEventAt = now;
    return isNewGesture;
  });

  assert.deepEqual(acceptedGestures, [1000]);
});

void test('a new swipe after the wheel stream settles advances once', () => {
  assert.equal(isNewReelWheelGesture(1700, 1000), true);
});
