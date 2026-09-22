'use client';

/* oxlint-disable jsx-a11y/media-has-caption -- This is an unpublished local recording preview. */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { saveTake, videoFrame } from '@/lib/local-recording';
import {
  createRecordingDevice,
  supportedRecordingMimeType,
  validRecordedTake,
} from '@/lib/recording-capabilities';
import {
  openRecordingCompanion,
  type RecordingCompanion,
} from '@/lib/recording-companion';
import { recordingCue } from '@/lib/recording-guidance';
import { useBought } from './bought-provider';

export function ScreenRecorder({
  dropId,
  onRecorded,
}: {
  dropId: string;
  onRecorded: (video: Blob, frame?: Blob) => void;
}) {
  const { api } = useBought();
  const preview = useRef<HTMLVideoElement>(null);
  const displayStream = useRef<MediaStream | null>(null);
  const microphoneStream = useRef<MediaStream | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
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
  const [mic, setMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [companionState, setCompanionState] = useState<
    'idle' | 'opening' | 'open' | 'unavailable'
  >('idle');
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false);

  const release = useCallback(() => {
    companionSession.current += 1;
    companion.current?.close();
    companion.current = null;
    setCompanionState('idle');
    clearInterval(monitor.current);
    clearTimeout(autoStop.current);
    monitor.current = undefined;
    autoStop.current = undefined;
    recordingStream.current?.getTracks().forEach((track) => track.stop());
    displayStream.current?.getTracks().forEach((track) => track.stop());
    microphoneStream.current?.getTracks().forEach((track) => track.stop());
    recordingStream.current = null;
    displayStream.current = null;
    microphoneStream.current = null;
    if (preview.current) preview.current.srcObject = null;
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
    setError('');
    release();
    let display: MediaStream | null = null;
    let microphone: MediaStream | null = null;
    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getDisplayMedia ||
        !window.MediaRecorder
      )
        throw new Error(
          'Use a supported desktop browser over HTTPS to record this category.',
        );
      display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });
      try {
        microphone = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        // Screen video remains useful on machines without an audio input.
        microphone = null;
      }
      if (!active.current) {
        display.getTracks().forEach((track) => track.stop());
        microphone?.getTracks().forEach((track) => track.stop());
        return;
      }
      const screenTrack = display.getVideoTracks()[0];
      const microphoneTrack = microphone?.getAudioTracks()[0];
      if (!screenTrack) throw new Error('Choose a screen source to continue.');

      displayStream.current = display;
      microphoneStream.current = microphone;
      const displayAudioTracks = display.getAudioTracks();
      setScreenAudio(displayAudioTracks.length > 0);

      let analyser: AnalyserNode | null = null;
      let recordingAudioTracks = displayAudioTracks;
      if (microphoneTrack && microphone) {
        const audioContext = new AudioContext();
        context.current = audioContext;
        const micSource = audioContext.createMediaStreamSource(microphone);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);
        if (displayAudioTracks.length) {
          const destination = audioContext.createMediaStreamDestination();
          micSource.connect(destination);
          const screenSource = audioContext.createMediaStreamSource(display);
          screenSource.connect(destination);
          recordingAudioTracks = destination.stream.getAudioTracks();
        } else {
          recordingAudioTracks = [microphoneTrack];
        }
      }
      const combined = new MediaStream([screenTrack, ...recordingAudioTracks]);
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
      microphoneTrack?.addEventListener('ended', () => {
        if (!active.current) return;
        setMic(false);
        setError(
          'The microphone disconnected. Screen recording can continue without it.',
        );
      });

      if (preview.current) {
        preview.current.srcObject = display;
        await preview.current.play();
      }

      const mime = supportedRecordingMimeType((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime)
        throw new Error(
          'This browser cannot create a supported screen recording.',
        );
      const recordingDevice = createRecordingDevice(combined, mime, 3000000);
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
          if (preview.current) frame = await videoFrame(preview.current);
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
        setMic(liveMic);
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
      setReady(true);
    } catch (err) {
      display?.getTracks().forEach((track) => track.stop());
      microphone?.getTracks().forEach((track) => track.stop());
      release();
      if (active.current)
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Screen sharing permission was not granted. Your payment is saved.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'No screen source was found. You can use Import Video below.'
              : err instanceof Error
                ? err.message
                : 'Could not prepare screen recording.',
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
        <video
          ref={preview}
          autoPlay
          muted
          playsInline
          aria-label="Live shared-screen preview"
        />
        {!ready && (
          <div className="drop-camera-placeholder">
            <MonitorUp size={42} strokeWidth={1} />
            <strong>
              {settingUp ? 'OPENING SCREEN PICKER' : 'SCREEN SHARE REQUIRED'}
            </strong>
            <span>Choose one screen, app window, or browser tab.</span>
          </div>
        )}
        <div className="drop-camera-top">
          <span>
            <i className={recording ? 'is-recording' : ''} />
            {recording ? 'REC' : ready ? 'SCREEN READY' : 'WAITING'}
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
            ? mic
              ? 'Your screen and voice are being recorded.'
              : 'Your screen is being recorded without microphone audio.'
            : 'Only the source you choose will be captured.'}
        </span>
      </div>
      <div className="drop-device-status" aria-live="polite">
        <span className={ready ? 'ready' : ''}>
          {ready ? <Check size={16} /> : <Circle size={14} />}
          {ready ? 'Screen visible' : 'Screen not shared'}
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
            ? 'The floating timer stays visible over other tabs and apps. It stops automatically at 02:00, or use STOP in the popup.'
            : companionState === 'opening'
              ? 'Opening the floating timer…'
              : 'This browser cannot open the floating timer, so keep this page visible. Recording still stops automatically at 02:00.'
          : 'Choose Entire Screen to move between apps, or choose one window to capture only that window. Keep this page open.'}
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
          {settingUp ? 'OPENING SCREEN PICKER…' : 'SHARE SCREEN'}
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
