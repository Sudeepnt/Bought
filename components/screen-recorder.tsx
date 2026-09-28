'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  Circle,
  Mic,
  MonitorUp,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  type Drop,
} from '@/lib/drop-domain';
import { saveTake } from '@/lib/local-recording';
import {
  createRecordingDevice,
  recordingProfile,
  supportedRecordingMimeType,
  validRecordedTake,
} from '@/lib/recording-capabilities';
import {
  containedRect,
  coveredSourceRect,
  faceBubbleRect,
} from '@/lib/recording-compositor';
import {
  openRecordingCompanion,
  type RecordingCompanion,
} from '@/lib/recording-companion';
import { recordingCue } from '@/lib/recording-guidance';
import { useRecordingWakeLock } from '@/lib/use-recording-wake-lock';
import { useBought } from './bought-provider';

function videoFor(stream: MediaStream) {
  const video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  return video;
}

async function canvasFrame(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not capture the composed video frame.')),
      'image/jpeg',
      0.88,
    ),
  );
}

function drawComposite(
  canvas: HTMLCanvasElement,
  screen: HTMLVideoElement,
  face: HTMLVideoElement | null,
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = '#020403';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (screen.videoWidth && screen.videoHeight) {
    const target = containedRect(
      screen.videoWidth,
      screen.videoHeight,
      canvas.width,
      canvas.height,
    );
    ctx.drawImage(screen, target.x, target.y, target.width, target.height);
  }

  if (!face?.videoWidth || !face.videoHeight) return;
  const bubble = faceBubbleRect(canvas.width, canvas.height);
  const source = coveredSourceRect(
    face.videoWidth,
    face.videoHeight,
    bubble.width,
    bubble.height,
  );
  const radius = bubble.width / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.round(canvas.width * 0.014);
  ctx.shadowOffsetY = Math.round(canvas.height * 0.008);
  ctx.fillStyle = '#050805';
  ctx.beginPath();
  ctx.arc(bubble.x + radius, bubble.y + radius, radius + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(bubble.x + radius, bubble.y + radius, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(bubble.x + bubble.width, bubble.y);
  ctx.scale(-1, 1);
  ctx.drawImage(
    face,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    bubble.width,
    bubble.height,
  );
  ctx.restore();

  ctx.strokeStyle = '#ef2b32';
  ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.004));
  ctx.beginPath();
  ctx.arc(
    bubble.x + radius,
    bubble.y + radius,
    radius - ctx.lineWidth / 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
}

export function ScreenRecorder({
  dropId,
  onRecorded,
}: {
  dropId: string;
  onRecorded: (video: Blob, frame?: Blob) => void;
}) {
  const { api } = useBought();
  const preview = useRef<HTMLCanvasElement>(null);
  const screenVideo = useRef<HTMLVideoElement | null>(null);
  const faceVideo = useRef<HTMLVideoElement | null>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const animationFrame = useRef<number | undefined>(undefined);
  const videoFrameRequest = useRef<number | undefined>(undefined);
  const monitor = useRef<number | undefined>(undefined);
  const started = useRef(0);
  const autoStop = useRef<number | undefined>(undefined);
  const companion = useRef<RecordingCompanion | null>(null);
  const companionSession = useRef(0);
  const active = useRef(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [screenAudio, setScreenAudio] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [companionState, setCompanionState] = useState<
    'idle' | 'opening' | 'open' | 'unavailable'
  >('idle');
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false);

  useRecordingWakeLock(recording);

  const release = useCallback(() => {
    companionSession.current += 1;
    companion.current?.close();
    companion.current = null;
    setCompanionState('idle');
    clearInterval(monitor.current);
    clearTimeout(autoStop.current);
    if (animationFrame.current !== undefined)
      cancelAnimationFrame(animationFrame.current);
    if (
      videoFrameRequest.current !== undefined &&
      screenVideo.current?.cancelVideoFrameCallback
    )
      screenVideo.current.cancelVideoFrameCallback(videoFrameRequest.current);
    monitor.current = undefined;
    autoStop.current = undefined;
    animationFrame.current = undefined;
    videoFrameRequest.current = undefined;
    const currentRecording = recordingStream.current;
    const currentDisplay = displayStream.current;
    const currentCamera = cameraStream.current;
    const currentMicrophone = microphoneStream.current;
    recordingStream.current = null;
    displayStream.current = null;
    cameraStream.current = null;
    microphoneStream.current = null;
    recorder.current = null;
    currentRecording?.getTracks().forEach((track) => track.stop());
    currentDisplay?.getTracks().forEach((track) => track.stop());
    currentCamera?.getTracks().forEach((track) => track.stop());
    currentMicrophone?.getTracks().forEach((track) => track.stop());
    if (screenVideo.current) screenVideo.current.srcObject = null;
    if (faceVideo.current) faceVideo.current.srcObject = null;
    screenVideo.current = null;
    faceVideo.current = null;
    void context.current?.close().catch(() => {});
    context.current = null;
  }, []);

  useEffect(() => {
    active.current = true;
    let current = true;
    void api<{ drop: Drop }>(`drops/${dropId}`)
      .then(({ drop }) => {
        if (!current) return;
        if (
          drop.payment_state !== 'paid' ||
          !['draft', 'rejected'].includes(drop.state) ||
          drop.capture_mode !== 'screen'
        )
          throw new Error(
            'A paid screen-share broadcast is required before capture opens.',
          );
        setPaymentReady(true);
      })
      .catch((err) => {
        if (current)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not verify this broadcast.',
          );
      });
    return () => {
      current = false;
      active.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    };
  }, [api, dropId, release]);

  useEffect(() => {
    if (!recording) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording]);

  async function setup() {
    if (!paymentReady || settingUp) return;
    setSettingUp(true);
    setReady(false);
    setCamera(false);
    setMic(false);
    setScreenAudio(false);
    setError('');
    release();
    let display: MediaStream | null = null;
    let cameraMedia: MediaStream | null = null;
    let microphoneMedia: MediaStream | null = null;
    try {
      const canvas = preview.current;
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getDisplayMedia ||
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder ||
        !canvas?.captureStream
      )
        throw new Error(
          'Use a supported desktop browser over HTTPS to record screen and camera together.',
        );

      const profile = recordingProfile({
        compact: window.matchMedia('(max-width: 700px)').matches,
        hardwareConcurrency: navigator.hardwareConcurrency,
      });
      display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: profile.width, max: 1920 },
          height: { ideal: profile.height, max: 1080 },
          frameRate: { ideal: profile.frameRate, max: 30 },
        },
        audio: true,
      });

      try {
        cameraMedia = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 640 },
            frameRate: { ideal: profile.frameRate, max: 30 },
          },
          audio: false,
        });
      } catch {
        cameraMedia = null;
      }
      try {
        microphoneMedia = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        microphoneMedia = null;
      }

      if (!active.current) {
        display.getTracks().forEach((track) => track.stop());
        cameraMedia?.getTracks().forEach((track) => track.stop());
        microphoneMedia?.getTracks().forEach((track) => track.stop());
        return;
      }

      const screenTrack = display.getVideoTracks()[0];
      const cameraTrack = cameraMedia?.getVideoTracks()[0];
      const microphoneTrack = microphoneMedia?.getAudioTracks()[0];
      if (!screenTrack) throw new Error('Choose a screen source to continue.');
      screenTrack.contentHint = 'detail';

      displayStream.current = display;
      cameraStream.current = cameraMedia;
      microphoneStream.current = microphoneMedia;
      const displayAudioTracks = display.getAudioTracks();
      setScreenAudio(displayAudioTracks.length > 0);

      const liveScreen = videoFor(new MediaStream([screenTrack]));
      screenVideo.current = liveScreen;
      await liveScreen.play();
      let liveFace: HTMLVideoElement | null = null;
      if (cameraTrack) {
        liveFace = videoFor(new MediaStream([cameraTrack]));
        faceVideo.current = liveFace;
        await liveFace.play();
      }

      canvas.width = profile.width;
      canvas.height = profile.height;
      const render = () => {
        drawComposite(canvas, liveScreen, liveFace);
        if (liveScreen.requestVideoFrameCallback)
          videoFrameRequest.current =
            liveScreen.requestVideoFrameCallback(render);
        else animationFrame.current = requestAnimationFrame(render);
      };
      render();

      const composedVideo = canvas.captureStream(profile.frameRate);
      const composedTrack = composedVideo.getVideoTracks()[0];
      if (!composedTrack)
        throw new Error('This browser could not compose the recording.');
      composedTrack.contentHint = 'detail';

      let analyser: AnalyserNode | null = null;
      let recordingAudioTracks: MediaStreamTrack[] = [];
      if (displayAudioTracks.length || microphoneTrack) {
        const audioContext = new AudioContext();
        context.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        if (displayAudioTracks.length) {
          const screenSource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks),
          );
          screenSource.connect(destination);
        }
        if (microphoneTrack) {
          const micSource = audioContext.createMediaStreamSource(
            new MediaStream([microphoneTrack]),
          );
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          micSource.connect(analyser);
          micSource.connect(destination);
        }
        recordingAudioTracks = destination.stream.getAudioTracks();
      }

      const combined = new MediaStream([
        composedTrack,
        ...recordingAudioTracks,
      ]);
      recordingStream.current = combined;

      const stopForLostSource = (message: string) => {
        if (!active.current) return;
        if (recorder.current?.state === 'recording') recorder.current.stop();
        else release();
        setReady(false);
        setError(message);
      };
      screenTrack.addEventListener('ended', () =>
        stopForLostSource(
          'Screen sharing stopped. Share the screen again to record.',
        ),
      );
      cameraTrack?.addEventListener('ended', () => {
        if (!active.current) return;
        liveFace = null;
        setCamera(false);
      });
      microphoneTrack?.addEventListener('ended', () => {
        if (!active.current) return;
        setMic(false);
      });

      const mime = supportedRecordingMimeType((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime)
        throw new Error(
          'This browser cannot create a supported screen recording.',
        );
      const recordingDevice = createRecordingDevice(
        combined,
        mime,
        profile.screenBitsPerSecond,
      );
      recorder.current = recordingDevice;
      let chunks: Blob[] = [];
      let totalBytes = 0;
      recordingDevice.onstart = () => {
        chunks = [];
        totalBytes = 0;
        started.current = performance.now();
      };
      recordingDevice.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          totalBytes += event.data.size;
        }
      };
      recordingDevice.onerror = () => {
        if (active.current)
          setError('Screen recording was interrupted. Please retake it.');
        if (recordingDevice.state === 'recording') recordingDevice.stop();
      };
      recordingDevice.onstop = async () => {
        const blob = new Blob(chunks, { type: recordingDevice.mimeType });
        let frame: Blob | undefined;
        try {
          frame = await canvasFrame(canvas);
        } catch {
          /* The recorded preview can capture a replacement frame. */
        }
        release();
        if (
          !validRecordedTake(blob.size, performance.now() - started.current)
        ) {
          if (active.current) {
            setRecording(false);
            setReady(false);
            setError(
              'Record at least one second, up to two minutes, then try again.',
            );
          }
          return;
        }
        try {
          await saveTake(dropId, blob, frame);
        } catch {
          /* The parent exposes a download if local recovery is unavailable. */
        }
        if (active.current) {
          setRecording(false);
          onRecorded(blob, frame);
        }
      };

      const values = analyser
        ? new Uint8Array(analyser.frequencyBinCount)
        : null;
      monitor.current = window.setInterval(() => {
        if (!active.current) return;
        const liveMic = !!(
          microphoneTrack &&
          microphoneTrack.readyState === 'live' &&
          microphoneTrack.enabled &&
          !microphoneTrack.muted
        );
        const liveCamera = !!(
          cameraTrack &&
          cameraTrack.readyState === 'live' &&
          cameraTrack.enabled &&
          !cameraTrack.muted
        );
        setMic(liveMic);
        setCamera(liveCamera);
        if (analyser && values) {
          analyser.getByteTimeDomainData(values);
          setLevel(
            Math.min(
              1,
              Math.sqrt(
                values.reduce(
                  (sum, value) => sum + ((value - 128) / 128) ** 2,
                  0,
                ) / values.length,
              ) * 5,
            ),
          );
        } else setLevel(0);
        if (recordingDevice.state === 'recording') {
          const elapsed = Math.floor(
            (performance.now() - started.current) / 1000,
          );
          setSeconds(elapsed);
          companion.current?.update(elapsed);
          if (elapsed >= MAX_VIDEO_SECONDS || totalBytes > MAX_VIDEO_BYTES)
            recordingDevice.stop();
        }
      }, 400);
      setMic(!!microphoneTrack);
      setCamera(!!cameraTrack);
      setReady(true);
    } catch (err) {
      display?.getTracks().forEach((track) => track.stop());
      cameraMedia?.getTracks().forEach((track) => track.stop());
      microphoneMedia?.getTracks().forEach((track) => track.stop());
      release();
      if (active.current)
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Screen sharing permission was not granted. Your payment is saved.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'No screen source was found. You can use Import Video below.'
              : err instanceof Error
                ? err.message
                : 'Could not prepare screen and camera recording.',
        );
    } finally {
      if (active.current) setSettingUp(false);
    }
  }

  function start() {
    if (!ready || recorder.current?.state !== 'inactive') return;
    setError('');
    setSeconds(0);
    void context.current?.resume();
    try {
      recorder.current.start(1000);
      autoStop.current = window.setTimeout(
        () =>
          recorder.current?.state === 'recording' && recorder.current.stop(),
        MAX_VIDEO_SECONDS * 1000,
      );
      setRecording(true);
      const session = ++companionSession.current;
      setCompanionState('opening');
      void openRecordingCompanion({
        durationSeconds: MAX_VIDEO_SECONDS,
        onClosed: () => {
          if (session !== companionSession.current) return;
          companion.current = null;
          setCompanionState('unavailable');
        },
        onStop: () => recorder.current?.stop(),
      }).then((handle) => {
        if (
          session !== companionSession.current ||
          recorder.current?.state !== 'recording'
        ) {
          handle?.close();
          return;
        }
        companion.current = handle;
        setCompanionState(handle ? 'open' : 'unavailable');
      });
    } catch {
      setError('Screen recording could not start. Share the screen again.');
    }
  }

  const remainingSeconds = Math.max(0, MAX_VIDEO_SECONDS - seconds);
  const cue = recordingCue(seconds);

  return (
    <>
      <div
        className={`drop-camera drop-screen-camera ${recording ? 'is-recording' : ''}`}
      >
        <canvas
          ref={preview}
          className="drop-composite-preview"
          aria-label="Live preview of the shared screen with the camera bubble"
        >
          Live preview of the shared screen with the camera bubble.
        </canvas>
        {!ready && (
          <div className="drop-camera-placeholder">
            <MonitorUp size={42} strokeWidth={1} />
            <strong>
              {settingUp
                ? 'CONNECTING SCREEN + CAMERA'
                : 'SCREEN SHARE REQUIRED'}
            </strong>
            <span>
              Choose a screen, then allow your camera and microphone. No camera?
              Screen and voice still work.
            </span>
          </div>
        )}
        <div className="drop-camera-top">
          <span>
            <i className={recording ? 'is-recording' : ''} />
            {recording
              ? 'REC'
              : ready
                ? camera
                  ? 'SCREEN + FACE READY'
                  : 'SCREEN READY'
                : 'WAITING'}
          </span>
          <span>
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')} / 02:00
          </span>
        </div>
        {recording && companionState === 'unavailable' && (
          <output
            className="drop-recording-countdown"
            aria-live="polite"
            aria-label={`${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`}
          >
            <span>TIME LEFT</span>
            <strong>
              {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
              {String(remainingSeconds % 60).padStart(2, '0')}
            </strong>
          </output>
        )}
        {recording && companionState === 'unavailable' && (
          <div className="drop-recording-prompt" aria-live="polite">
            <strong>{cue.title}</strong>
            <span>{cue.message}</span>
          </div>
        )}
        <span className="drop-camera-caption">
          {recording
            ? camera
              ? mic
                ? 'Your screen, round face camera, and voice are being recorded.'
                : 'Your screen and round face camera are recording without a microphone.'
              : mic
                ? 'Your screen and voice are recording. No camera was found.'
                : 'Your screen is recording without camera or microphone.'
            : camera
              ? 'The round face bubble shown here is baked into the final video.'
              : 'A real camera bubble appears here when a camera is available.'}
        </span>
      </div>
      <div className="drop-device-status" aria-live="polite">
        <span className={ready ? 'ready' : ''}>
          {ready ? <Check size={16} /> : <Circle size={14} />}
          {ready ? 'Screen visible' : 'Screen not shared'}
        </span>
        <span className={camera ? 'ready' : ''}>
          {camera ? <Camera size={16} /> : <CameraOff size={16} />}
          {camera ? 'Face bubble ready' : 'No camera — bubble hidden'}
        </span>
        <span className={mic ? 'ready' : ''}>
          <Mic size={16} />
          {mic ? 'Microphone ready' : 'No microphone — screen only'}
          <i className="drop-mic-meter">
            <b style={{ width: `${Math.max(3, level * 100)}%` }} />
          </i>
        </span>
        <span className={screenAudio ? 'ready' : ''}>
          <Volume2 size={16} />
          {screenAudio ? 'Screen audio included' : 'Screen audio optional'}
        </span>
      </div>
      <p className="drop-recording-guidance">
        {recording
          ? companionState === 'open'
            ? 'The floating timer stays visible over other tabs and apps. Recording stops automatically at 02:00, or use STOP in the popup.'
            : companionState === 'opening'
              ? 'Opening the floating timer…'
              : 'This browser cannot open the floating timer, so keep this page visible. Recording still stops automatically at 02:00.'
          : camera
            ? 'Move to the tab or app you are presenting. Your mirrored face stays round at the bottom right of the saved video.'
            : 'No camera is connected, so this will record the selected screen and any available audio without adding a fake face.'}
      </p>
      {error && (
        <p className="drop-error" role="alert">
          {error}
        </p>
      )}
      {!ready ? (
        <button
          className="drop-button primary"
          type="button"
          disabled={!paymentReady || settingUp}
          onClick={() => void setup()}
        >
          <MonitorUp size={17} />
          {settingUp ? 'CONNECTING DEVICES…' : 'SHARE SCREEN + CAMERA'}
        </button>
      ) : (
        <div className="drop-actions">
          <button
            className="drop-button"
            type="button"
            disabled={recording}
            onClick={() => void setup()}
          >
            <RotateCcw size={17} /> CHANGE SOURCE
          </button>
          <button
            className={`drop-button ${recording ? 'recording' : 'primary'}`}
            type="button"
            onClick={recording ? () => recorder.current?.stop() : start}
          >
            {recording ? (
              <>
                <Square size={16} fill="currentColor" /> STOP RECORDING
              </>
            ) : (
              <>
                <Circle size={16} fill="currentColor" /> START RECORDING
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
