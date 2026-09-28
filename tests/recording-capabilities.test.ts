import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_VIDEO_BYTES } from '../lib/drop-domain';
import {
  importedRecordingIssue,
  recordingProfile,
  recordingExtension,
  supportedRecordingMimeType,
  validRecordedTake,
} from '../lib/recording-capabilities';

void test('recording codecs use a consistent browser-safe preference order', () => {
  assert.equal(
    supportedRecordingMimeType((type) =>
      ['video/webm;codecs=vp8,opus', 'video/webm'].includes(type),
    ),
    'video/webm;codecs=vp8,opus',
  );
  assert.equal(
    supportedRecordingMimeType(() => false),
    undefined,
  );
  assert.equal(recordingExtension('video/mp4;codecs=avc1'), 'mp4');
  assert.equal(recordingExtension('video/quicktime'), 'mov');
  assert.equal(recordingExtension('video/webm;codecs=vp9,opus'), 'webm');
});

void test('completed takes enforce minimum duration and maximum bytes', () => {
  assert.equal(validRecordedTake(1, 1000), true);
  assert.equal(validRecordedTake(MAX_VIDEO_BYTES, 120_000), true);
  assert.equal(validRecordedTake(0, 1000), false);
  assert.equal(validRecordedTake(1, 999), false);
  assert.equal(validRecordedTake(MAX_VIDEO_BYTES + 1, 1000), false);
});

void test('mobile and low-power devices use a lighter recording profile', () => {
  const mobile = recordingProfile({ compact: true, hardwareConcurrency: 8 });
  const lowPower = recordingProfile({
    compact: false,
    hardwareConcurrency: 4,
  });
  const desktop = recordingProfile({
    compact: false,
    hardwareConcurrency: 10,
  });
  assert.equal(mobile.width, 960);
  assert.equal(mobile.frameRate, 24);
  assert.equal(lowPower.faceSampleMs, 650);
  assert.equal(desktop.width, 1280);
  assert.equal(desktop.frameRate, 30);
  assert.ok(mobile.cameraBitsPerSecond < desktop.cameraBitsPerSecond);
});

void test('imported takes enforce browser-checkable media requirements', () => {
  const valid = {
    size: 10_000,
    type: 'video/mp4',
    duration: 60,
    width: 1080,
    height: 1920,
  };
  assert.equal(importedRecordingIssue(valid), null);
  assert.match(
    importedRecordingIssue({ ...valid, type: 'application/octet-stream' })!,
    /video file/,
  );
  assert.equal(
    importedRecordingIssue({
      ...valid,
      type: 'application/octet-stream',
      name: 'phone-recording.MOV',
    }),
    null,
  );
  assert.match(
    importedRecordingIssue({ ...valid, size: MAX_VIDEO_BYTES + 1 })!,
    /250 MB/,
  );
  assert.match(
    importedRecordingIssue({ ...valid, duration: 121 })!,
    /2 minutes/,
  );
  assert.match(importedRecordingIssue({ ...valid, width: 200 })!, /240/);
});
