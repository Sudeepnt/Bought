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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const media = navigator.mediaDevices;
      setSupported(
        window.isSecureContext &&
          !!media?.getUserMedia &&
          !!window.MediaRecorder &&
          recorderSupported() &&
          (mode === 'camera' || !!media.getDisplayMedia),
      );
      setError('');
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  async function testCapture() {
    if (checking || !supported) return;
    setChecking(true);
    setError('');
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
        const microphone = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streams.push(microphone);
        if (!microphone.getAudioTracks().length)
          throw new Error('A microphone is required for this broadcast.');
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
            ? `${mode === 'screen' ? 'A microphone was not found' : 'No camera was found on this device'}. Use the other-recorder option below.`
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
            {mode === 'screen' ? 'SCREEN + MICROPHONE' : 'CAMERA + MICROPHONE'}
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
          ? 'This category needs visible proof. Test screen sharing here, or record with another screen recorder and import the finished video after checkout.'
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
                ? 'TEST SCREEN + MIC'
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
