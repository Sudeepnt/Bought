import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { test } from 'node:test';
import { muxPlaybackToken } from '../lib/server/providers';
import {
  ALL_CAPTION_LANGUAGES,
  FEATURED_CAPTION_LANGUAGES,
  OTHER_CAPTION_LANGUAGES,
} from '../lib/caption-languages';
import {
  isEnglishCaptionLanguage,
  captionTranslationTargets,
  muxGeneratedSubtitles,
  selectReadyMuxCaptionTrack,
} from '../lib/server/transcription';

void test('Mux caption language selection only accepts English tracks', () => {
  assert.equal(isEnglishCaptionLanguage('en'), true);
  assert.equal(isEnglishCaptionLanguage('en-US'), true);
  assert.equal(isEnglishCaptionLanguage('EN-gb'), true);
  assert.equal(isEnglishCaptionLanguage('auto'), false);
  assert.equal(isEnglishCaptionLanguage('hi'), false);
  assert.equal(isEnglishCaptionLanguage(undefined), false);
});

void test('Mux uploads request auto-detected captions with broadcast identity', () => {
  assert.deepEqual(muxGeneratedSubtitles('drop-123'), [
    {
      language_code: 'auto',
      name: 'Original captions',
      passthrough: 'drop-123',
    },
  ]);
});

void test('ready English captions win over the original language track', () => {
  const english = {
    id: 'translated-english',
    type: 'text',
    status: 'ready',
    language_code: 'en',
  };
  assert.equal(
    selectReadyMuxCaptionTrack([
      {
        id: 'original-hindi',
        type: 'text',
        status: 'ready',
        language_code: 'hi',
        text_source: 'generated_vod',
      },
      english,
    ]),
    english,
  );
});

void test('Mux translates each generated track into the missing top languages', () => {
  assert.deepEqual(
    captionTranslationTargets(
      [
        {
          id: 'source',
          type: 'text',
          status: 'ready',
          language_code: 'hi',
          text_source: 'generated_vod',
        },
        {
          id: 'existing-spanish',
          type: 'text',
          status: 'preparing',
          language_code: 'es-MX',
        },
      ],
      'hi',
    ),
    ['en', 'zh', 'fr', 'bn', 'pt', 'ru', 'id', 'de', 'ja'],
  );
});

void test('caption selector pins ten languages and alphabetizes every other language', () => {
  assert.equal(ALL_CAPTION_LANGUAGES.length, 86);
  assert.equal(FEATURED_CAPTION_LANGUAGES.length, 10);
  assert.deepEqual(
    FEATURED_CAPTION_LANGUAGES.map(({ code }) => code),
    ['en', 'zh', 'es', 'fr', 'bn', 'pt', 'ru', 'id', 'de', 'ja'],
  );
  for (const code of ['ar', 'hi', 'ur']) {
    assert.equal(
      FEATURED_CAPTION_LANGUAGES.some((language) => language.code === code),
      false,
    );
    assert.equal(
      OTHER_CAPTION_LANGUAGES.some((language) => language.code === code),
      true,
    );
  }
  assert.deepEqual(
    OTHER_CAPTION_LANGUAGES.map(({ label }) => label),
    OTHER_CAPTION_LANGUAGES.map(({ label }) => label).toSorted((a, b) =>
      a.localeCompare(b),
    ),
  );
  assert.equal(
    new Set([
      ...FEATURED_CAPTION_LANGUAGES.map(({ code }) => code),
      ...OTHER_CAPTION_LANGUAGES.map(({ code }) => code),
    ]).size,
    ALL_CAPTION_LANGUAGES.length,
  );
});

void test('caption selection ignores unfinished tracks and falls back to generated captions', () => {
  const generated = {
    id: 'original-spanish',
    type: 'text',
    status: 'ready',
    language_code: 'es',
    text_source: 'generated_vod',
  };
  assert.equal(
    selectReadyMuxCaptionTrack([
      {
        id: 'english-preparing',
        type: 'text',
        status: 'preparing',
        language_code: 'en',
      },
      generated,
    ]),
    generated,
  );
  assert.equal(
    selectReadyMuxCaptionTrack([
      { id: 'audio', type: 'audio', status: 'ready' },
      { id: 'caption', type: 'text', status: 'preparing' },
    ]),
    null,
  );
});

void test('Mux playback token carries the signing key ID and a valid signature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const previousId = process.env.MUX_SIGNING_KEY_ID;
  const previousKey = process.env.MUX_SIGNING_PRIVATE_KEY;
  process.env.MUX_SIGNING_KEY_ID = 'test-signing-key';
  process.env.MUX_SIGNING_PRIVATE_KEY = privateKey
    .export({ format: 'pem', type: 'pkcs1' })
    .toString();
  try {
    const [header, claims, signature] =
      muxPlaybackToken('test-playback').split('.');
    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString()) as {
      sub: string;
      aud: string;
      kid: string;
      exp: number;
      default_subtitles_lang: string;
    };
    assert.equal(payload.sub, 'test-playback');
    assert.equal(payload.aud, 'v');
    assert.equal(payload.kid, 'test-signing-key');
    assert.equal(payload.default_subtitles_lang, 'en');
    assert.ok(payload.exp > Date.now() / 1000);
    assert.equal(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${claims}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
      true,
    );
  } finally {
    if (previousId === undefined) delete process.env.MUX_SIGNING_KEY_ID;
    else process.env.MUX_SIGNING_KEY_ID = previousId;
    if (previousKey === undefined) delete process.env.MUX_SIGNING_PRIVATE_KEY;
    else process.env.MUX_SIGNING_PRIVATE_KEY = previousKey;
  }
});
