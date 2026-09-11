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
import { useBought } from './bought-provider';

function supportedMimeType() {
  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));
}

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
  const active = useRef(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [screenAudio, setScreenAudio] = useState(false);
  const [mic, setMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [settingUp, setSettingUp] = useState(false);

  const release = useCallback(() => {
    clearInterval(monitor.current);
    monitor.current = undefined;
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
        !navigator.mediaDevices.getUserMedia ||
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
      microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!active.current) {
        display.getTracks().forEach((track) => track.stop());
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      const screenTrack = display.getVideoTracks()[0];
      const microphoneTrack = microphone.getAudioTracks()[0];
      if (!screenTrack || !microphoneTrack)
        throw new Error('A shared screen and microphone are both required.');

      displayStream.current = display;
      microphoneStream.current = microphone;
      setScreenAudio(display.getAudioTracks().length > 0);

      const audioContext = new AudioContext();
      context.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      const micSource = audioContext.createMediaStreamSource(microphone);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      micSource.connect(analyser);
      micSource.connect(destination);
      if (display.getAudioTracks().length) {
        const screenSource = audioContext.createMediaStreamSource(display);
        screenSource.connect(destination);
      }
      const mixedAudio = destination.stream.getAudioTracks()[0];
      const combined = new MediaStream([
        screenTrack,
        ...(mixedAudio ? [mixedAudio] : [microphoneTrack]),
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
      microphoneTrack.addEventListener('ended', () =>
        stopForLostSource(
          'Your microphone disconnected. Reconnect it before recording.',
        ),
      );

      if (preview.current) {
        preview.current.srcObject = display;
        await preview.current.play();
      }

      const mime = supportedMimeType();
      if (!mime)
        throw new Error(
          'This browser cannot create a supported screen recording.',
        );
      const recordingDevice = new MediaRecorder(combined, {
        mimeType: mime,
        videoBitsPerSecond: 3000000,
      });
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
          blob.size === 0 ||
          blob.size > MAX_VIDEO_BYTES ||
          performance.now() - started.current < 1000
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

      const values = new Uint8Array(analyser.frequencyBinCount);
      monitor.current = window.setInterval(() => {
        if (!active.current) return;
        const liveMic =
          microphoneTrack.readyState === 'live' &&
          microphoneTrack.enabled &&
          !microphoneTrack.muted;
        setMic(liveMic);
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
        if (recordingDevice.state === 'recording') {
          const elapsed = Math.floor(
            (performance.now() - started.current) / 1000,
          );
          setSeconds(elapsed);
          if (elapsed >= MAX_VIDEO_SECONDS || totalBytes > MAX_VIDEO_BYTES)
            recordingDevice.stop();
        }
      }, 400);
      setMic(true);
      setReady(true);
    } catch (err) {
      display?.getTracks().forEach((track) => track.stop());
      microphone?.getTracks().forEach((track) => track.stop());
      release();
      if (active.current)
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Screen or microphone permission was not granted. Your payment is saved.'
            : err instanceof Error
              ? err.message
              : 'Could not prepare screen recording.',
        );
    } finally {
      if (active.current) setSettingUp(false);
    }
  }

  function start() {
    if (!ready || !mic || recorder.current?.state !== 'inactive') return;
    setError('');
    setSeconds(0);
    void context.current?.resume();
    try {
      recorder.current.start(1000);
      setRecording(true);
    } catch {
      setError('Screen recording could not start. Share the screen again.');
    }
  }

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
        <span className="drop-camera-caption">
          {recording
            ? 'Your screen and voice are being recorded.'
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
          {mic ? 'Microphone ready' : 'Microphone waiting'}
          <i className="drop-mic-meter">
            <b style={{ width: `${Math.max(3, level * 100)}%` }} />
          </i>
        </span>
        <span className={screenAudio ? 'ready' : ''}>
          <Volume2 size={16} />
          {screenAudio ? 'Screen audio included' : 'Screen audio optional'}
        </span>
      </div>
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
          {settingUp ? 'OPENING SCREEN PICKER…' : 'SHARE SCREEN + MIC'}
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
            disabled={!mic}
            onClick={
              recording
                ? () => recorder.current?.stop()
                : start
            }
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
