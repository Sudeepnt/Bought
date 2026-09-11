'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  MonitorUp,
  ShieldCheck,
} from 'lucide-react';
import type { CaptureMode } from '@/lib/drop-domain';

function recorderSupported() {
  if (!window.MediaRecorder) return false;
  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4',
    'video/webm',
  ].some((type) => MediaRecorder.isTypeSupported(type));
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
          throw new Error('Choose a screen, window, or browser tab to continue.');
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
          ? 'This category needs visible proof. You will choose a screen, app window, or browser tab. The test stops sharing immediately.'
          : 'This category is built for a direct take. Test your camera and microphone before opening checkout.'}
      </p>
      {supported === false && (
        <p className="drop-capture-warning" role="alert">
          <AlertTriangle size={16} />
          {mode === 'screen'
            ? 'Screen recording needs a supported desktop browser. Open this broadcast on desktop before paying.'
            : 'This browser cannot record a camera broadcast over the current connection.'}
        </p>
      )}
      {error && (
        <p className="drop-capture-warning" role="alert">
          <AlertTriangle size={16} /> {error}
        </p>
      )}
      <button
        className="drop-button drop-preflight-button"
        type="button"
        disabled={!supported || checking || passed}
        onClick={() => void testCapture()}
      >
        {passed
          ? 'CAPTURE CHECK PASSED'
          : checking
            ? 'CHECKING…'
            : mode === 'screen'
              ? 'TEST SCREEN + MIC'
              : 'TEST CAMERA + MIC'}
        {passed && <Check size={16} />}
      </button>
    </section>
  );
}
