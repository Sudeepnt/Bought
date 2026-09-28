import assert from 'node:assert/strict';
import test from 'node:test';
import {
  containedRect,
  coveredSourceRect,
  faceBubbleRect,
} from '../lib/recording-compositor';

void test('screen content is contained without changing its aspect ratio', () => {
  assert.deepEqual(containedRect(1920, 1080, 1280, 720), {
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  });
  assert.deepEqual(containedRect(1080, 1920, 1280, 720), {
    x: 437.5,
    y: 0,
    width: 405,
    height: 720,
  });
});

void test('camera content is center-cropped to fill the round bubble', () => {
  assert.deepEqual(coveredSourceRect(1920, 1080, 200, 200), {
    x: 420,
    y: 0,
    width: 1080,
    height: 1080,
  });
  assert.deepEqual(coveredSourceRect(720, 1280, 200, 200), {
    x: 0,
    y: 280,
    width: 720,
    height: 720,
  });
});

void test('face bubble is round-sized and anchored inside the bottom right', () => {
  const bubble = faceBubbleRect(1280, 720);
  assert.deepEqual(bubble, {
    x: 1005,
    y: 445,
    width: 243,
    height: 243,
  });
  assert.equal(bubble.x + bubble.width < 1280, true);
  assert.equal(bubble.y + bubble.height < 720, true);
});
