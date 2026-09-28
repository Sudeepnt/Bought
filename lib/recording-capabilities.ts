import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from './drop-domain';

export const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/mp4',
  'video/webm',
] as const;

export function recordingProfile({
  compact,
  hardwareConcurrency,
}: {
  compact: boolean;
  hardwareConcurrency?: number;
}) {
  const lowerPower = compact || (hardwareConcurrency ?? 8) <= 4;
  return lowerPower
    ? {
        width: 960,
        height: 540,
        cameraBitsPerSecond: 1_800_000,
        screenBitsPerSecond: 2_200_000,
        faceSampleMs: 650,
        frameRate: 24,
      }
    : {
        width: 1280,
        height: 720,
        cameraBitsPerSecond: 2_500_000,
        screenBitsPerSecond: 3_000_000,
        faceSampleMs: 400,
        frameRate: 30,
      };
}

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
  name,
  duration,
  width,
  height,
}: {
  size: number;
  type: string;
  name?: string;
  duration: number;
  width: number;
  height: number;
}) {
  const recognizedType = type.toLowerCase().startsWith('video/');
  const recognizedExtension = /\.(mp4|mov|webm|m4v)$/i.test(name ?? '');
  if (!recognizedType && !recognizedExtension)
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
