'use client';

/* oxlint-disable jsx-a11y/media-has-caption -- Local capture test media has no caption track. */
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Circle,
  MonitorUp,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import { MarketTopbar } from '@/components/market-topbar';
import { MAX_VIDEO_SECONDS } from '@/lib/drop-domain';
import { videoFrame } from '@/lib/local-recording';
import {
  openRecordingCompanion,
  type RecordingCompanion,
} from '@/lib/recording-companion';
import { recordingCue } from '@/lib/recording-guidance';
import {
  createRecordingDevice,
  supportedRecordingMimeType,
} from '@/lib/recording-capabilities';

export default function CaptureTestPage() {
  const display = useRef<MediaStream | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const companion = useRef<RecordingCompanion | null>(null);
  const companionSession = useRef(0);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [companionState, setCompanionState] = useState<
    'idle' | 'opening' | 'open' | 'unavailable'
  >('idle');
  const [audioSource, setAudioSource] = useState('');
  const [take, setTake] = useState<Blob | null>(null);
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [error, setError] = useState('');

  function closeCompanion() {
    companionSession.current += 1;
    companion.current?.close();
    companion.current = null;
    setCompanionState('idle');
  }

  function release() {
    closeCompanion();
    display.current?.getTracks().forEach((track) => track.stop());
    microphone.current?.getTracks().forEach((track) => track.stop());
    display.current = null;
    microphone.current = null;
    recorder.current = null;
    setReady(false);
  }

  useEffect(() => {
    const url = take ? URL.createObjectURL(take) : '';
    const frame = requestAnimationFrame(() => setPreviewUrl(url));
    return () => {
      cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [take]);

  useEffect(() => {
    const url = thumbnail ? URL.createObjectURL(thumbnail) : '';
    const frame = requestAnimationFrame(() => setThumbnailUrl(url));
    return () => {
      cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [thumbnail]);

  useEffect(() => () => release(), []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor(
        (performance.now() - startedAt.current) / 1000,
      );
      const currentSeconds = Math.min(MAX_VIDEO_SECONDS, elapsed);
      setSeconds(currentSeconds);
      companion.current?.update(currentSeconds);
      if (
        elapsed >= MAX_VIDEO_SECONDS &&
        recorder.current?.state === 'recording'
      )
        recorder.current.stop();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function chooseSource() {
    release();
    setError('');
    setTake(null);
    setThumbnail(null);
    setAccepted(false);
    try {
      const shared = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      display.current = shared;
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        microphone.current = mic;
      } catch {
        /* A display-audio or video-only test remains useful without a microphone. */
      }

      const videoTrack = shared.getVideoTracks()[0];
      const micTrack = mic?.getAudioTracks()[0];
      const displayAudioTrack = shared.getAudioTracks()[0];
      if (!videoTrack) throw new Error('No screen source was selected.');
      const audioTrack = micTrack ?? displayAudioTrack;
      setAudioSource(
        micTrack
          ? 'Microphone included'
          : displayAudioTrack
            ? 'Shared-tab audio included; no microphone found'
            : 'Video-only; no microphone or shared audio found',
      );
      const stream = new MediaStream([
        videoTrack,
        ...(audioTrack ? [audioTrack] : []),
      ]);
      const mime = supportedRecordingMimeType((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw new Error('This browser cannot create a recording.');
      const device = createRecordingDevice(stream, mime, 3_000_000);
      recorder.current = device;
      device.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      device.onstop = () => {
        const blob = new Blob(chunks.current, { type: device.mimeType });
        chunks.current = [];
        if (blob.size) setTake(blob);
        setRecording(false);
        release();
      };
      videoTrack.addEventListener('ended', () => {
        if (device.state === 'recording') device.stop();
        else release();
      });
      setReady(true);
    } catch (reason) {
      release();
      setError(
        reason instanceof Error
          ? reason.message
          : 'Screen capture could not be prepared.',
      );
    }
  }

  function start() {
    if (!ready || recorder.current?.state !== 'inactive') return;
    chunks.current = [];
    setSeconds(0);
    startedAt.current = performance.now();
    recorder.current.start(500);
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
      onStop: stop,
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
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  const remainingSeconds = Math.max(0, MAX_VIDEO_SECONDS - seconds);
  const cue = recordingCue(seconds);

  async function captureThumbnail() {
    try {
      if (!preview.current) return;
      setThumbnail(await videoFrame(preview.current));
      setError('');
    } catch {
      setError('Could not capture this frame. Play the video and try again.');
    }
  }

  return (
    <main className="market-shell dashboard-shell">
      <MarketTopbar active="broadcast" />
      <div className="drop-page">
        <header className="drop-page-heading">
          <div>
            <span className="drop-eyebrow">
              <i /> REAL LOCAL CAPTURE TEST
            </span>
            <h1>
              RECORD A REAL TAB<span>.</span>
            </h1>
            <p>
              This uses the browser’s actual screen picker and MediaRecorder.
              Nothing is generated, uploaded, paid, reviewed, or published.
            </p>
          </div>
        </header>

        <section className="drop-workspace">
          <div className={`drop-camera ${recording ? 'is-recording' : ''}`}>
            {previewUrl ? (
              <video
                ref={preview}
                src={previewUrl}
                controls
                playsInline
                autoPlay
                onLoadedData={() => {
                  if (!thumbnail) void captureThumbnail();
                }}
              />
            ) : (
              <div className="drop-camera-placeholder">
                <MonitorUp size={42} strokeWidth={1} />
                <strong>
                  {recording
                    ? 'RECORDING THE SELECTED TAB'
                    : ready
                      ? 'SOURCE READY'
                      : 'CHOOSE A REAL TAB OR SCREEN'}
                </strong>
                <span>
                  {recording
                    ? 'Switch to the shared tab, interact with it, then return here.'
                    : 'The finished capture will play here.'}
                </span>
              </div>
            )}
            <div className="drop-camera-top">
              <span>
                <i className={recording ? 'is-recording' : ''} />
                {recording ? 'REC' : previewUrl ? 'REAL CAPTURE' : 'READY'}
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
          </div>

          <div className="drop-device-status" aria-live="polite">
            <span className={ready || recording || previewUrl ? 'ready' : ''}>
              {ready || recording || previewUrl ? (
                <Check size={16} />
              ) : (
                <Circle size={14} />
              )}
              {previewUrl ? 'Recording completed' : 'Real screen source'}
            </span>
            {audioSource && <span>{audioSource}</span>}
          </div>

          {recording && (
            <p className="drop-recording-guidance">
              {companionState === 'open'
                ? 'The floating timer stays visible over other tabs and apps. It stops automatically at 02:00, or use STOP in the popup.'
                : companionState === 'opening'
                  ? 'Opening the floating timer…'
                  : 'This browser cannot open the floating timer, so keep this page visible. Recording still stops automatically at 02:00.'}
            </p>
          )}

          {error && (
            <p className="drop-error" role="alert">
              {error}
            </p>
          )}

          <div className="drop-actions">
            <button
              className="drop-button"
              type="button"
              disabled={recording}
              onClick={() => void chooseSource()}
            >
              <MonitorUp size={17} /> CHOOSE REAL SOURCE
            </button>
            <button
              className={`drop-button ${recording ? 'recording' : 'primary'}`}
              type="button"
              disabled={!ready && !recording}
              onClick={recording ? stop : start}
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
            {previewUrl && (
              <button
                className={`drop-button ${accepted ? 'accepted' : 'primary'}`}
                type="button"
                onClick={() => setAccepted(true)}
              >
                <Check size={17} />
                {accepted ? 'BROADCAST SELECTED' : 'USE THIS BROADCAST'}
              </button>
            )}
          </div>

          {accepted && (
            <section className="drop-thumbnail-section">
              <div className="drop-section-label">
                <span>03 /</span> THUMBNAIL
              </div>
              <p>This thumbnail is generated from the real recording above.</p>
              <div className="drop-thumbnail-picker">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt="Frame captured from the real screen recording"
                    width={1280}
                    height={720}
                    unoptimized
                  />
                ) : (
                  <div className="drop-thumbnail-empty">
                    <Camera size={28} />
                  </div>
                )}
                <div>
                  <button
                    className="drop-button"
                    type="button"
                    onClick={() => void captureThumbnail()}
                  >
                    <Camera size={16} /> USE CURRENT VIDEO FRAME
                  </button>
                  <small>The frame never leaves this browser.</small>
                </div>
              </div>

              <div className="drop-confirmed">
                <ShieldCheck size={28} />
                <div>
                  <h2>04 / PUBLISH AREA REACHED</h2>
                  <p>
                    Real capture and thumbnail are ready locally. No payment,
                    upload, review, or publication has been simulated.
                  </p>
                </div>
              </div>
              <button
                className="drop-button primary drop-submit"
                type="button"
                disabled
              >
                LIVE BACKEND REQUIRED TO PUBLISH
                <Upload size={18} />
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
