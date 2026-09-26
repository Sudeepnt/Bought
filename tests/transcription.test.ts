import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEnglishCaptionLanguage } from '../lib/server/transcription';

void test('Mux caption language selection only accepts English tracks', () => {
  assert.equal(isEnglishCaptionLanguage('en'), true);
  assert.equal(isEnglishCaptionLanguage('en-US'), true);
  assert.equal(isEnglishCaptionLanguage('EN-gb'), true);
  assert.equal(isEnglishCaptionLanguage('auto'), false);
  assert.equal(isEnglishCaptionLanguage('hi'), false);
  assert.equal(isEnglishCaptionLanguage(undefined), false);
});
