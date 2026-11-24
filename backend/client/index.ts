// Bought's browser side with no interface of its own: sign-in, the camera profile and take checks,
// the microphone check, the wake lock, the local recovery copy, video and picture upload to Cloudflare R2
// on signed links, signed playback and checkout. The newspaper's Advertise page calls these from its own buttons.
import type { SupabaseClient } from '@supabase/supabase-js';
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
  recordingProfile,
  supportedRecordingMimeType,
  validRecordedTake,
} from '../lib/recording-capabilities';

let client: SupabaseClient | null = null;

export async function connect(url: string, key: string) {
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
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

// Ends the session in this browser (the profile picture's Sign out).
export async function signOut() {
  if (!client) return;
  await client.auth.signOut();
}

export async function userEmail() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user?.email ?? null;
}

const DONE_PAGE = '/auth/done.html';

// Google or Facebook sign-in in a small window, so the sheet keeps everything typed so far. The window comes back to
// /auth/done.html, which stores the session (same origin, so this page reads it too) and says so on a
// BroadcastChannel. Google's pages cut the window's link to this page, so `popup.closed` can't be trusted:
// we wait for the message or the stored session, until cancelGoogle() or ten minutes.
// If the browser blocks the window, the whole page goes to Google and comes back to the Advertise page.
let cancelWait: (() => void) | null = null;

export function cancelGoogle() {
  cancelWait?.();
}

export async function oauthSignIn(provider: 'google' | 'facebook'): Promise<boolean> {
  const popup = window.open('', `bought-${provider}`, 'popup,width=500,height=680');
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${location.origin}${DONE_PAGE}${popup ? '' : '?back=1'}`,
      skipBrowserRedirect: true,
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
    },
  });
  if (error || !data?.url) {
    popup?.close();
    throw error ?? new Error(`${provider === 'google' ? 'Google' : 'Facebook'} sign-in is not available right now.`);
  }
  if (!popup) {
    location.assign(data.url);
    return false;
  }
  popup.location.href = data.url;
  return new Promise((resolve) => {
    const channel = new BroadcastChannel('bought-auth');
    // the message only says "look now": the stored session is what counts
    const finish = async () => {
      clearInterval(timer);
      clearTimeout(limit);
      channel.close();
      cancelWait = null;
      resolve(await signedIn());
    };
    channel.onmessage = () => finish();
    const timer = setInterval(async () => {
      if (await signedIn()) finish();
    }, 1000);
    const limit = setTimeout(finish, 10 * 60_000);
    cancelWait = finish;
  });
}

export const googleSignIn = () => oauthSignIn('google');

// Runs on /auth/done.html: the client reads the sign-in from the address and stores it.
export async function finishSignIn(url: string, key: string) {
  await connect(url, key);
  const { data } = await supabase().auth.getSession();
  return !!data.session;
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

// A recording aid: tells the person when the microphone hears nothing. Runs on the device only.
export function watchTake(
  _video: HTMLVideoElement,
  stream: MediaStream,
  report: (state: { sound: boolean }) => void,
  sampleMs: number,
) {
  let audio: AudioContext | null = null;
  let timer = 0;
  let loud = 0;
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
      report({ sound: Date.now() - loud < 6000 });
    }, sampleMs);
  } catch {
    // Without an audio graph the take still records.
  }
  return () => {
    window.clearInterval(timer);
    void audio?.close().catch(() => {});
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
  // straight to R2 on a link for this ad's picture, locked to its type and exact size
  const target = await api<{ url: string; contentType: string }>(`ads/ads/${adId}/image`, {
    contentType: normalized.type,
    size: normalized.size,
  });
  const response = await fetch(target.url, {
    method: 'PUT',
    headers: { 'Content-Type': target.contentType },
    body: normalized,
  }).catch(() => null);
  if (!response?.ok) throw new Error('Image upload failed. Your bid is saved. Try again.');
}

type UploadTarget = { url: string; key: string; contentType: string };
type UploadCheck = { state: string; media: string; reason: string | null };

// One PUT of the whole file to the signed link. R2 takes it all or nothing, so a retry starts over.
function putFile(target: UploadTarget, blob: Blob, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', target.url);
    xhr.setRequestHeader('Content-Type', target.contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload network'));
    xhr.ontimeout = () => reject(new Error('upload timeout'));
    xhr.send(blob);
  });
}

export async function uploadVideo(
  adId: string,
  blob: Blob,
  onProgress: (percent: number) => void,
  replace = false,
) {
  let target: UploadTarget | null = null;
  for (let attempt = 0; ; attempt++) {
    // Each try asks for a fresh link; after the first it reuses the same take, so a retry costs no upload.
    target = await api<UploadTarget>(`ads/ads/${adId}/upload`, {
      replace: attempt === 0 && replace,
      type: blob.type,
      size: blob.size,
    });
    // Keep a copy until the upload lands, so a refresh or dropped connection can't lose the take.
    await saveTake(adId, blob, undefined, target.key).catch(() => {});
    try {
      await putFile(target, blob, onProgress);
      break;
    } catch {
      if (attempt >= 4) throw new Error('The upload was interrupted. Your recording is saved. Try again.');
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  const checked = await api<UploadCheck>(`ads/ads/${adId}/uploaded`, { key: target.key });
  if (checked.media === 'errored') {
    const error = new Error(checked.reason || 'Your video could not be used. Upload a new one.');
    error.name = 'VideoRejected';
    throw error;
  }
  await markTakeUploaded(adId, target.key).catch(() => false);
}

// ---------- playback: a short-lived signed link to the file in R2, into the page's own <video> ----------
export async function attach(video: HTMLVideoElement, adId: string) {
  const media = await api<{ url: string; poster?: string | null }>(`media/${adId}`);
  if (media.poster && !video.poster) video.poster = media.poster;
  // The page renders ad videos with preload="none"; metadata is needed before the caller seeks and plays.
  video.preload = 'metadata';
  video.src = media.url;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => fail(), 20000);
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', ok);
      video.removeEventListener('error', fail);
    };
    const ok = () => (done(), resolve());
    const fail = () => (done(), reject(new Error('This video could not be played.')));
    video.addEventListener('loadedmetadata', ok);
    video.addEventListener('error', fail);
    video.load();
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
