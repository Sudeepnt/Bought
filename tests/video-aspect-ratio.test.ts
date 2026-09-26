import assert from 'node:assert/strict';
import test from 'node:test';
import { portraitVideoAspectRatio } from '../lib/video-aspect-ratio';

void test('portrait phone videos preserve their source aspect ratio', () => {
  assert.equal(portraitVideoAspectRatio(1080, 1920), 9 / 16);
  assert.equal(portraitVideoAspectRatio(1080, 1440), 3 / 4);
});

void test('landscape, square, and invalid media use the standard card ratio', () => {
  assert.equal(portraitVideoAspectRatio(1920, 1080), null);
  assert.equal(portraitVideoAspectRatio(1080, 1080), null);
  assert.equal(portraitVideoAspectRatio(0, 1920), null);
  assert.equal(portraitVideoAspectRatio(Number.NaN, 1920), null);
});
