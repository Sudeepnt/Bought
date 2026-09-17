import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from './drop-domain';

export const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/mp4',
  'video/webm',
] as const;

export function supportedRecordingMimeType(
  isSupported: (type: string) => boolean,
) {
  return RECORDING_MIME_TYPES.find(isSupported);
}

export function createRecordingDevice(
  stream: MediaStream,
  mimeType: string,
  videoBitsPerSecond: number,
) {
  try {
    return new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  } catch {
    // Some otherwise compatible Safari versions reject the optional bitrate.
    return new MediaRecorder(stream, { mimeType });
  }
}

export function validRecordedTake(size: number, elapsedMs: number) {
  return size > 0 && size <= MAX_VIDEO_BYTES && elapsedMs >= 1000;
}

export function importedRecordingIssue({
  size,
  type,
  duration,
  width,
  height,
}: {
  size: number;
  type: string;
  duration: number;
  width: number;
  height: number;
}) {
  if (!type.toLowerCase().startsWith('video/'))
    return 'Choose a video file recorded as MP4, MOV, or WebM.';
  if (size <= 0 || size > MAX_VIDEO_BYTES)
    return 'Choose a video larger than 0 bytes and no more than 250 MB.';
  if (
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > MAX_VIDEO_SECONDS
  )
    return 'Choose a video between 1 second and 2 minutes long.';
  if (width < 240 || height < 240)
    return 'Choose a video that is at least 240 × 240 pixels.';
  return null;
}

export function recordingExtension(mimeType: string) {
  const type = mimeType.toLowerCase();
  if (type.includes('quicktime')) return 'mov';
  if (type.includes('mp4') || type.includes('m4v')) return 'mp4';
  return 'webm';
}
