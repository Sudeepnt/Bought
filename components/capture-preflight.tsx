'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ExternalLink,
  MonitorUp,
  ShieldCheck,
} from 'lucide-react';
import type { CaptureMode } from '@/lib/drop-domain';
import { supportedRecordingMimeType } from '@/lib/recording-capabilities';

function recorderSupported() {
  if (!window.MediaRecorder) return false;
  return !!supportedRecordingMimeType((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

export function CapturePreflight({
  mode,
  passed,
  onPassed,
}: {
  mode: CaptureMode;
  passed: boolean;
  onPassed: () => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const media = navigator.mediaDevices;
      const recordingSupported =
        window.isSecureContext && !!window.MediaRecorder && recorderSupported();
      setSupported(
        !!recordingSupported &&
          (mode === 'screen'
            ? !!media?.getDisplayMedia &&
              !!media?.getUserMedia &&
              !!HTMLCanvasElement.prototype.captureStream
            : !!media?.getUserMedia),
      );
      setError('');
      setNotice('');
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  async function testCapture() {
    if (checking || !supported) return;
    setChecking(true);
    setError('');
    setNotice('');
    const streams: MediaStream[] = [];
    try {
      if (mode === 'screen') {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        streams.push(display);
        if (!display.getVideoTracks().length)
          throw new Error(
            'Choose a screen, window, or browser tab to continue.',
          );
        let hasCamera = false;
        let hasMicrophone = false;
        try {
          const camera = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
          });
          streams.push(camera);
          hasCamera = camera.getVideoTracks().length > 0;
        } catch {
          /* The screen recorder remains usable without a face bubble. */
        }
        try {
          const microphone = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          streams.push(microphone);
          hasMicrophone = microphone.getAudioTracks().length > 0;
        } catch {
          /* Shared-tab audio or silent screen recording can still work. */
        }
        if (!hasCamera || !hasMicrophone)
          setNotice(
            hasCamera
              ? 'Screen and face camera work. No microphone was found; shared-tab audio may still be included.'
              : hasMicrophone
                ? 'Screen and microphone work. No camera was found, so the face bubble will be hidden.'
                : 'Screen sharing works. No camera or microphone was found; the recorder will use shared-tab audio when available.',
          );
      } else {
        const camera = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streams.push(camera);
        if (!camera.getVideoTracks().length || !camera.getAudioTracks().length)
          throw new Error('A camera and microphone are required.');
      }
      onPassed();
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? `${mode === 'screen' ? 'Screen sharing' : 'Camera or microphone'} permission was not granted.`
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? `${mode === 'screen' ? 'No screen source was found' : 'No camera was found on this device'}. Use the other-recorder option below.`
            : err instanceof Error
              ? err.message
              : 'This browser could not complete the recording check.',
      );
    } finally {
      streams.forEach((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      setChecking(false);
    }
  }

  const Icon = mode === 'screen' ? MonitorUp : Camera;
  return (
    <section className="drop-capture-plan" aria-labelledby="capture-plan-title">
      <div className="drop-capture-plan-head">
        <span className="drop-capture-icon">
          <Icon size={20} />
        </span>
        <div>
          <span className="drop-eyebrow">
            {mode === 'screen'
              ? 'SCREEN + FACE BUBBLE + AUDIO'
              : 'CAMERA + MICROPHONE'}
          </span>
          <h3 id="capture-plan-title">
            {mode === 'screen'
              ? 'SHOW THE RECEIPTS.'
              : 'YOUR FACE. YOUR VOICE.'}
          </h3>
        </div>
        <span className={`drop-preflight-state ${passed ? 'is-ready' : ''}`}>
          {passed ? <Check size={14} /> : <ShieldCheck size={14} />}
          {passed ? 'READY' : 'CHECK REQUIRED'}
        </span>
      </div>
      <p>
        {mode === 'screen'
          ? 'Test the streamer layout here. Your shared screen fills the video and a real camera appears in a round bottom-right bubble. Camera, microphone, and shared-tab audio are used when available.'
          : 'Test your camera here. If this computer has no camera, record on your phone or another device and import the finished video after checkout.'}
      </p>
      {supported === false && (
        <p className="drop-capture-warning" role="alert">
          <AlertTriangle size={16} />
          {mode === 'screen'
            ? 'Direct screen recording is unavailable here. You can still record elsewhere and import the video.'
            : 'Direct camera recording is unavailable here. You can still use a phone or another device.'}
        </p>
      )}
      {error && (
        <p className="drop-capture-warning" role="alert">
          <AlertTriangle size={16} /> {error}
        </p>
      )}
      {notice && <p className="drop-notice">{notice}</p>}
      <div className="drop-preflight-actions">
        <button
          className="drop-button drop-preflight-button"
          type="button"
          disabled={!supported || checking || passed}
          onClick={() => void testCapture()}
        >
          {passed
            ? 'CAPTURE PLAN READY'
            : checking
              ? 'CHECKING…'
              : mode === 'screen'
                ? 'TEST SCREEN + FACE CAMERA'
                : 'TEST CAMERA + MIC'}
          {passed && <Check size={16} />}
        </button>
        {!passed && (
          <button
            className="drop-button"
            type="button"
            disabled={checking}
            onClick={onPassed}
          >
            <ExternalLink size={16} />
            {mode === 'camera'
              ? 'USE PHONE / OTHER CAMERA'
              : 'USE ANOTHER RECORDER'}
          </button>
        )}
      </div>
      {!passed && (
        <small className="drop-preflight-help">
          You will upload the finished video here. It must include clear voice
          audio, be 1 second–2 minutes long, at least 240 × 240, and no more
          than 250 MB.
        </small>
      )}
    </section>
  );
}
