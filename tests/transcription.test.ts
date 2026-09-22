import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segmentsToVtt } from '../lib/server/transcription';

void test('timestamped translation segments become safe English WebVTT cues', () => {
  const vtt = segmentsToVtt([
    { start: 0, end: 1.234, text: '  Hello\nworld.  ' },
    { start: 2, end: 2, text: 'Invalid duration' },
    { start: 3_661.005, end: 3_662.5, text: 'Never --> inject timing' },
  ]);

  assert.equal(
    vtt,
    [
      'WEBVTT',
      '',
      '1',
      '00:00:00.000 --> 00:00:01.234',
      'Hello world.',
      '',
      '3',
      '01:01:01.005 --> 01:01:02.500',
      'Never → inject timing',
      '',
    ].join('\n'),
  );
});

void test('invalid or empty segments do not create caption cues', () => {
  assert.equal(
    segmentsToVtt([
      { start: -1, end: 1, text: 'Before zero' },
      { start: 1, end: 2, text: '   ' },
      { start: Number.NaN, end: 4, text: 'Not a number' },
    ]),
    'WEBVTT\n\n\n',
  );
});
