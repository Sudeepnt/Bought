// Bought's browser side with no interface of its own: sign-in, the camera profile and take checks,
// the face and sound guide, the wake lock, the local recovery copy, resumable upload to Mux, image
// upload, signed playback and checkout. The newspaper's Advertise page calls these from its own buttons.
import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { SupabaseClient } from '@supabase/supabase-js';
import { THUMBNAIL_BUCKET } from '../lib/drop-domain';
import {
  deleteTake,
  loadTake,
  markTakeUploaded,
  normalizeThumbnail,
  saveTake,
  videoFrame,
} from '../lib/local-recording';
import {
  createRecordingDevice,
  importedRecordingIssue,
  recordingExtension,
  recordingProfile,
  supportedRecordingMimeType,
  validRecordedTake,
} from '../lib/recording-capabilities';

let client: SupabaseClient | null = null;

export async function connect(url: string, key: string) {
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url, key);
  return client;
}

function supabase() {
  if (!client) throw new Error('Advertising is not connected yet.');
  return client;
}

export async function token() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signedIn() {
  return !!(await token());
}

export async function sendCode(email: string) {
  const { error } = await supabase().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string) {
  const { error } = await supabase().auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

export async function api<T = Record<string, unknown>>(path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  const access = await token();
  if (access) headers.Authorization = `Bearer ${access}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`api/bought/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Please try again in a moment.');
  return data as T;
}

// ---------- recording ----------
export function cameraSettings() {
  const compact = matchMedia('(max-width: 720px)').matches;
  const profile = recordingProfile({
    compact,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });
  return {
    profile,
    constraints: {
      video: {
        width: { ideal: profile.width },
        height: { ideal: profile.height },
        frameRate: { ideal: profile.frameRate },
      },
      audio: { echoCancellation: true, noiseSuppression: true },
    } satisfies MediaStreamConstraints,
  };
}

export function recorderFor(stream: MediaStream, bitsPerSecond: number) {
  const mime = supportedRecordingMimeType((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('This browser cannot record video.');
  return createRecordingDevice(stream, mime, bitsPerSecond);
}

export { importedRecordingIssue, validRecordedTake };

// Mobile browsers may dim or lock the display during a long take.
export function holdScreen() {
  let lock: WakeLockSentinel | null = null;
  let done = false;
  const acquire = async () => {
    if (done || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      // Recording stays usable when a browser or low-power mode denies it.
    }
  };
  const changed = () => void acquire();
  void acquire();
  document.addEventListener('visibilitychange', changed);
  return () => {
    done = true;
    document.removeEventListener('visibilitychange', changed);
    void lock?.release().catch(() => {});
  };
}

// A recording aid, never proof of identity. A person still reviews every ad. MediaPipe runs on the
// device: no picture leaves the browser for this check.
export function watchTake(
  video: HTMLVideoElement,
  stream: MediaStream,
  report: (state: { face: boolean | null; sound: boolean }) => void,
  sampleMs: number,
) {
  let active = true;
  let detector: FaceDetector | null = null;
  let audio: AudioContext | null = null;
  let timer = 0;
  let face: boolean | null = null;
  let previous = -1;
  let loud = 0;
  void (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks('mediapipe/wasm');
      const made = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'mediapipe/blaze_face_short_range.tflite' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.6,
      });
      if (!active) made.close();
      else detector = made;
    } catch {
      // The face guide is optional. Recording never depends on it.
    }
  })();
  try {
    audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    audio.createMediaStreamSource(stream).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(values);
      const level = Math.sqrt(values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / values.length) * 5;
      loud = level > 0.04 ? Date.now() : loud;
      if (detector && video.readyState >= 2 && video.currentTime !== previous) {
        previous = video.currentTime;
        try {
          face = detector.detectForVideo(video, performance.now()).detections.length === 1;
        } catch {
          face = null;
        }
      }
      report({ face, sound: Date.now() - loud < 6000 });
    }, sampleMs);
  } catch {
    // Without an audio graph the take still records.
  }
  return () => {
    active = false;
    window.clearInterval(timer);
    void audio?.close().catch(() => {});
    detector?.close();
  };
}

// ---------- saving and uploading a take ----------
export const saveLocal = (id: string, blob: Blob) => saveTake(id, blob);
export const loadLocal = (id: string) => loadTake(id);
export const dropLocal = (id: string) => deleteTake(id);

export async function posterFrom(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Could not read this video.'));
      window.setTimeout(() => reject(new Error('Could not read this video.')), 8000);
    });
    return await videoFrame(video);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImage(adId: string, file: Blob) {
  const normalized = await normalizeThumbnail(
    file instanceof File ? file : new File([file], 'image.jpg', { type: file.type }),
  );
  const target = await api<{ path: string; token: string }>(`ads/ads/${adId}/image`, {
    contentType: normalized.type,
  });
  const { error } = await supabase()
    .storage.from(THUMBNAIL_BUCKET)
    .uploadToSignedUrl(target.path, target.token, normalized, {
      contentType: normalized.type,
    });
  if (error) throw new Error('Image upload failed. Your bid is saved. Try again.');
}

export async function uploadVideo(
  adId: string,
  blob: Blob,
  onProgress: (percent: number) => void,
  replace = false,
) {
  const target = await api<{ url: string; uploadId: string }>(`ads/ads/${adId}/upload`, { replace });
  // Keep a copy until the upload lands, so a refresh or dropped connection can't lose the take.
  await saveTake(adId, blob, undefined, target.uploadId).catch(() => {});
  const { createUpload } = await import('@mux/upchunk');
  await new Promise<void>((resolve, reject) => {
    const task = createUpload({
      endpoint: target.url,
      file: new File([blob], `ad-${adId}.${recordingExtension(blob.type)}`, { type: blob.type }),
      chunkSize: 5120,
      attempts: 5,
    });
    task.on('progress', (event) => onProgress(event.detail));
    task.on('success', () => resolve());
    task.on('error', () => reject(new Error('The upload was interrupted. Your recording is saved. Try again.')));
  });
  await markTakeUploaded(adId, target.uploadId).catch(() => false);
}

// ---------- playback: signed Mux HLS into the page's own <video> ----------
export async function attach(video: HTMLVideoElement, adId: string) {
  const media = await api<{ playbackId: string; token: string; poster?: string | null }>(`media/${adId}`);
  const src = `https://stream.mux.com/${media.playbackId}.m3u8?token=${media.token}`;
  if (media.poster && !video.poster) video.poster = media.poster;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    return;
  }
  const { default: Hls } = await import('hls.js/light');
  const hls = new Hls();
  hls.loadSource(src);
  hls.attachMedia(video);
  await new Promise<void>((resolve, reject) => {
    hls.on(Hls.Events.MANIFEST_PARSED, () => resolve());
    hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
      if (data.fatal) reject(new Error('This video could not be played.'));
    });
  });
}

// ---------- paying for credits ----------
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

function razorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The payment window could not load.'));
    document.head.appendChild(script);
  });
}

// The browser only opens the payment. Credits arrive when the provider's signed webhook lands.
export async function topup(amount: number, method: 'upi' | 'card') {
  const checkout = await api<{
    provider: string;
    url: string | null;
    orderId: string;
    amount: number;
    currency: string;
    key?: string;
    email?: string;
  }>('ads/topup', { id: crypto.randomUUID(), amount, method });
  if (checkout.provider === 'stripe') {
    location.assign(checkout.url!);
    return 'redirect' as const;
  }
  await razorpayScript();
  return new Promise<'paid' | 'closed'>((resolve) => {
    new window.Razorpay!({
      key: checkout.key,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: 'Bought.',
      description: 'Bought. credits',
      prefill: { email: checkout.email },
      method: { upi: true, card: false, netbanking: false, wallet: false, emi: false, paylater: false },
      handler: () => resolve('paid'),
      modal: { ondismiss: () => resolve('closed') },
    }).open();
  });
}
