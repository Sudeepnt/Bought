import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingUploadRequired } from '../lib/local-recording';

void test('recording retries never reuse a completed direct-upload URL', () => {
  assert.equal(
    recordingUploadRequired({
      replace: false,
      mediaState: 'waiting',
      localUploadId: 'upload-1',
      serverUploadId: 'upload-1',
      localUploadCompleted: true,
    }),
    false,
  );

  assert.equal(
    recordingUploadRequired({
      replace: false,
      mediaState: 'waiting',
      localUploadId: 'upload-1',
      serverUploadId: 'upload-1',
      localUploadCompleted: false,
    }),
    true,
  );

  assert.equal(
    recordingUploadRequired({
      replace: false,
      mediaState: 'processing',
      serverUploadId: 'upload-1',
      localUploadCompleted: false,
    }),
    false,
  );

  assert.equal(
    recordingUploadRequired({
      replace: true,
      mediaState: 'ready',
      serverUploadId: 'old-upload',
      localUploadCompleted: false,
    }),
    true,
  );
});
