import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseSocialAvatarUrl,
  socialAvatarImageUrl,
} from '../lib/social-avatar';

void test('social profile links resolve to platform-specific avatar lookups', () => {
  assert.deepEqual(parseSocialAvatarUrl('https://x.com/openai'), {
    platform: 'x',
    provider: 'x',
    identifier: 'openai',
    normalizedUrl: 'https://x.com/openai',
  });
  assert.equal(
    parseSocialAvatarUrl('instagram.com/willsmith/').identifier,
    'willsmith',
  );
  assert.equal(
    parseSocialAvatarUrl('https://linkedin.com/in/wesbos').identifier,
    'user:wesbos',
  );
  assert.equal(
    parseSocialAvatarUrl('https://youtube.com/@mkbhd').identifier,
    '@mkbhd',
  );
  assert.equal(
    parseSocialAvatarUrl('https://tiktok.com/@carlosazaustre').identifier,
    'carlosazaustre',
  );
});

void test('non-profile and unsupported links are rejected', () => {
  assert.throws(() => parseSocialAvatarUrl('https://x.com/home'));
  assert.throws(() => parseSocialAvatarUrl('https://instagram.com/p/abc'));
  assert.throws(() => parseSocialAvatarUrl('https://youtube.com/watch?v=abc'));
  assert.throws(() => parseSocialAvatarUrl('https://example.com/person'));
});

void test('saved image URLs remain stable provider URLs', () => {
  assert.equal(
    socialAvatarImageUrl(parseSocialAvatarUrl('https://x.com/openai')),
    'https://unavatar.io/x/openai?fallback=false',
  );
});
