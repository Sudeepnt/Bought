'use client';

/* oxlint-disable jsx-a11y/media-has-caption -- This is an unpublished local recording preview; no caption track exists yet. */
import Image from 'next/image';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Circle,
  ImagePlus,
  Mic,
  RotateCcw,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { UpChunk } from '@mux/upchunk';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  THUMBNAIL_BUCKET,
  type Drop,
} from '@/lib/drop-domain';
import {
  deleteTake,
  loadTake,
  markTakeUploaded,
  normalizeThumbnail,
  recordingUploadRequired,
  saveTake,
  videoFrame,
} from '@/lib/local-recording';
import {
  createRecordingDevice,
  importedRecordingIssue,
  recordingExtension,
  supportedRecordingMimeType,
  validRecordedTake,
} from '@/lib/recording-capabilities';
import {
  openRecordingCompanion,
  type RecordingCompanion,
} from '@/lib/recording-companion';
import { recordingCue } from '@/lib/recording-guidance';
import { useBought } from './bought-provider';
import { ScreenRecorder } from './screen-recorder';

function CameraRecorder({
  dropId,
  onRecorded,
}: {
  dropId: string;
  onRecorded: (video: Blob, frame?: Blob) => void;
}) {
  const { api } = useBought();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const detector = useRef<FaceDetector | null>(null);
  const context = useRef<AudioContext | null>(null);
  const started = useRef(0);
  const autoStop = useRef<number | undefined>(undefined);
  const companion = useRef<RecordingCompanion | null>(null);
  const companionSession = useRef(0);
  const facePresent = useRef(false);
  const [face, setFace] = useState(false);
  const [mic, setMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [companionState, setCompanionState] = useState<
    'idle' | 'opening' | 'open' | 'unavailable'
  >('idle');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  function closeCompanion() {
    companionSession.current += 1;
    companion.current?.close();
    companion.current = null;
    setCompanionState('idle');
  }

  useEffect(() => {
    let active = true;
    let monitor: number | undefined;
    let totalBytes = 0;
    let previousVideoTime = -1;
    const stop = () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
    };
    const connect = async () => {
      setReady(false);
      setError('');
      setFace(false);
      setMic(false);
      try {
        // This second server read is the permission gate, even after a payment return URL.
        const { drop } = await api<{ drop: Drop }>(`drops/${dropId}`);
        if (
          drop.payment_state !== 'paid' ||
          !['draft', 'rejected'].includes(drop.state)
        )
          throw new Error(
            'Payment confirmation is required before opening the camera.',
          );
        if (!active) return;
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
          throw new Error(
            'Use a current browser with camera recording support over HTTPS.',
          );
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        media.getTracks().forEach((track) =>
          track.addEventListener('ended', () => {
            if (active) {
              stop();
              setReady(false);
              setError(
                'Your camera or microphone disconnected. Reconnect to retake.',
              );
            }
          }),
        );
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        const { FaceDetector, FilesetResolver } =
          await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/blaze_face_short_range.tflite',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.6,
        });
        if (!active) {
          faceDetector.close();
          return;
        }
        detector.current = faceDetector;
        try {
          context.current = new AudioContext();
          const source = context.current.createMediaStreamSource(media);
          const analyser = context.current.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const values = new Uint8Array(analyser.frequencyBinCount);
          monitor = window.setInterval(() => {
            if (!active) return;
            const track = media.getAudioTracks()[0];
            setMic(
              !!track &&
                track.readyState === 'live' &&
                track.enabled &&
                !track.muted,
            );
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
            if (
              video.current &&
              video.current.readyState >= 2 &&
              video.current.currentTime !== previousVideoTime
            ) {
              previousVideoTime = video.current.currentTime;
              try {
                const found =
                  faceDetector.detectForVideo(video.current, performance.now())
                    .detections.length === 1;
                facePresent.current = found;
                setFace(found);
              } catch {
                facePresent.current = false;
                setFace(false);
              }
            }
            if (recorder.current?.state === 'recording') {
              const elapsed = Math.floor(
                (performance.now() - started.current) / 1000,
              );
              setSeconds(elapsed);
              companion.current?.update(elapsed);
              if (elapsed >= MAX_VIDEO_SECONDS || totalBytes > MAX_VIDEO_BYTES)
                stop();
            }
          }, 400);
        } catch {
          throw new Error(
            'The microphone could not be checked. Reconnect your devices.',
          );
        }
        // Enforce the byte limit independently of state updates.
        const mime = supportedRecordingMimeType((type) =>
          MediaRecorder.isTypeSupported(type),
        );
        if (!mime)
          throw new Error(
            'This browser cannot record a supported broadcast. Try Chrome, Edge, or Safari.',
          );
        const recordingDevice = createRecordingDevice(media, mime, 2500000);
        recorder.current = recordingDevice;
        let chunks: Blob[] = [];
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
          if (active)
            setError(
              'Recording was interrupted. Please retake your broadcast.',
            );
          stop();
        };
        recordingDevice.onstop = async () => {
          closeCompanion();
          clearTimeout(autoStop.current);
          autoStop.current = undefined;
          const blob = new Blob(chunks, { type: recordingDevice.mimeType });
          if (
            !validRecordedTake(blob.size, performance.now() - started.current)
          ) {
            if (active) {
              setRecording(false);
              setError(
                'Record at least one second, up to two minutes, then try again.',
              );
            }
            return;
          }
          let frame: Blob | undefined;
          try {
            if (video.current) frame = await videoFrame(video.current);
          } catch {
            /* The preview can capture a replacement frame. */
          }
          // Save even if navigation interrupts recording; the paid broadcast remains resumable.
          try {
            await saveTake(dropId, blob, frame);
          } catch {
            /* The parent exposes a download if local storage is unavailable. */
          }
          if (active) {
            setRecording(false);
            onRecorded(blob, frame);
          }
        };
        setReady(true);
      } catch (err) {
        stream.current?.getTracks().forEach((track) => track.stop());
        if (active)
          setError(
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Camera or microphone access was denied. Allow both in your browser settings, then try again. Your payment is saved.'
              : err instanceof DOMException && err.name === 'NotFoundError'
                ? 'No camera was found on this computer. Record on a phone or another device, then use Import Video below. Your payment is saved.'
                : err instanceof Error
                  ? err.message
                  : 'Could not open the camera.',
          );
      }
    };
    void connect();
    return () => {
      active = false;
      closeCompanion();
      clearTimeout(autoStop.current);
      stop();
      clearInterval(monitor);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      detector.current?.close();
      detector.current = null;
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, [api, attempt, dropId, onRecorded]);

  useEffect(() => {
    if (!recording) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recording]);

  function start() {
    if (
      !ready ||
      !facePresent.current ||
      !mic ||
      recorder.current?.state !== 'inactive'
    )
      return;
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
      setError('Recording could not start. Reconnect your camera.');
    }
  }

  const remainingSeconds = Math.max(0, MAX_VIDEO_SECONDS - seconds);
  const cue = recordingCue(seconds);

  return (
    <>
      <div className={`drop-camera ${recording ? 'is-recording' : ''}`}>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className="drop-live-video"
          aria-label="Live camera preview"
        />
        {!ready && (
          <div className="drop-camera-placeholder">
            <Camera size={42} strokeWidth={1} />
            <strong>
              {error ? 'CAMERA UNAVAILABLE' : 'OPENING YOUR CAMERA'}
            </strong>
            <span>Your payment is confirmed.</span>
          </div>
        )}
        <div className="drop-camera-top">
          <span>
            <i className={recording ? 'is-recording' : ''} />
            {recording ? 'REC' : 'LIVE PREVIEW'}
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
        {ready && <div className="drop-face-guide" aria-hidden="true" />}
        <span className="drop-camera-caption">
          {recording
            ? face
              ? 'You’re recording. Make it count.'
              : 'Keep one face clearly in frame.'
            : 'Your face. Your voice. Your position.'}
        </span>
      </div>
      <div className="drop-device-status" aria-live="polite">
        <span className={face ? 'ready' : ''}>
          {face ? <Check size={16} /> : <Circle size={14} />}{' '}
          {face ? 'Face visible' : 'Keep one face in frame'}
        </span>
        <span className={mic ? 'ready' : ''}>
          <Mic size={16} />
          {mic ? 'Microphone ready' : 'Checking microphone'}
          <i className="drop-mic-meter">
            <b style={{ width: `${Math.max(3, level * 100)}%` }} />
          </i>
        </span>
      </div>
      <p className="drop-recording-guidance">
        {recording
          ? companionState === 'open'
            ? 'The floating timer stays visible over other tabs and apps. It stops automatically at 02:00, or use STOP in the popup.'
            : companionState === 'opening'
              ? 'Opening the floating timer…'
              : 'This browser cannot open the floating timer, so keep this page visible. Recording still stops automatically at 02:00.'
          : 'You may switch tabs or apps after recording starts. Do not close or reload this page.'}
      </p>
      {error && (
        <p className="drop-error" role="alert">
          {error}
        </p>
      )}
      {error && !ready ? (
        <button
          className="drop-button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RotateCcw size={17} />
          RECONNECT CAMERA
        </button>
      ) : (
        <button
          className={`drop-button ${recording ? 'recording' : 'primary'}`}
          disabled={!ready || (!recording && (!face || !mic))}
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
      )}
    </>
  );
}

export function DropRecorder({
  drop,
  refresh,
}: {
  drop: Drop;
  refresh: () => Promise<void>;
}) {
  const { api, client } = useBought();
  const [restored, setRestored] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [replace, setReplace] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const uploader = useRef<UpChunk | null>(null);
  const savedUploadId = useRef<string | undefined>(undefined);
  const uploadCompleted = useRef(false);
  const initialUploadId = useRef(drop.mux_upload_id);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    void loadTake(drop.id)
      .then((saved) => {
        if (active && saved) {
          setBlob(saved.video);
          setThumbnail(saved.thumbnail ?? null);
          savedUploadId.current = saved.uploadId;
          uploadCompleted.current = saved.uploaded === true;
          setReplace(
            !saved.uploadId || saved.uploadId !== initialUploadId.current,
          );
          setNotice('Your last recording was restored from this device.');
        }
      })
      .catch(() => {
        if (active)
          setNotice(
            'This browser cannot save a recovery copy. Download your recording before leaving.',
          );
      })
      .finally(() => {
        if (active) setRestored(true);
      });
    return () => {
      active = false;
    };
  }, [drop.id]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploader.current?.abort();
    };
  }, []);
  useEffect(() => {
    const url = blob ? URL.createObjectURL(blob) : '';
    const frame = requestAnimationFrame(() => setVideoUrl(url));
    return () => {
      cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob]);
  useEffect(() => {
    const url = thumbnail ? URL.createObjectURL(thumbnail) : '';
    const frame = requestAnimationFrame(() => setThumbnailUrl(url));
    return () => {
      cancelAnimationFrame(frame);
      if (url) URL.revokeObjectURL(url);
    };
  }, [thumbnail]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const onRecorded = useCallback(
    (take: Blob, frame?: Blob) => {
      savedUploadId.current = undefined;
      uploadCompleted.current = false;
      setBlob(take);
      setThumbnail(frame ?? null);
      setAccepted(false);
      setReplace(true);
      void saveTake(drop.id, take, frame).catch(() =>
        setNotice(
          'Download this recording before leaving; a local recovery copy could not be saved.',
        ),
      );
    },
    [drop.id],
  );

  async function importRecording(file: File) {
    if (importing) return;
    setImporting(true);
    setError('');
    const url = URL.createObjectURL(file);
    try {
      const metadata = await new Promise<{
        duration: number;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const imported = document.createElement('video');
        const timeout = window.setTimeout(
          () =>
            reject(
              new Error(
                'The video took too long to read. Try MP4, MOV, or WebM.',
              ),
            ),
          15_000,
        );
        imported.preload = 'metadata';
        imported.muted = true;
        imported.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve({
            duration: imported.duration,
            width: imported.videoWidth,
            height: imported.videoHeight,
          });
        };
        imported.onerror = () => {
          clearTimeout(timeout);
          reject(
            new Error(
              'This browser could not read that video. Try MP4, MOV, or WebM.',
            ),
          );
        };
        imported.src = url;
      });
      const issue = importedRecordingIssue({
        size: file.size,
        type: file.type,
        ...metadata,
      });
      if (issue) throw new Error(issue);
      onRecorded(file);
      setNotice(
        'Video imported. Play it back and confirm that your face or screen is clear and your voice is audible.',
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not import this video.',
      );
    } finally {
      URL.revokeObjectURL(url);
      setImporting(false);
    }
  }

  async function chooseThumbnail(next: Blob) {
    setThumbnail(next);
    if (blob)
      try {
        await saveTake(
          drop.id,
          blob,
          next,
          savedUploadId.current,
          uploadCompleted.current,
        );
      } catch {
        setNotice('Download your recording before leaving this device.');
      }
  }

  async function captureFrame() {
    try {
      if (preview.current)
        await chooseThumbnail(await videoFrame(preview.current));
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not capture a frame.',
      );
    }
  }

  async function submit() {
    if (!blob || !thumbnail || !accepted || !client || busy) return;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const { drop: current } = await api<{ drop: Drop }>(`drops/${drop.id}`);
      if (current.payment_state !== 'paid')
        throw new Error(
          'Payment could not be confirmed. Refresh to check your broadcast.',
        );
      if (!['draft', 'rejected'].includes(current.state)) {
        await refresh();
        return;
      }
      if (
        recordingUploadRequired({
          replace,
          mediaState: current.media_state,
          localUploadId: savedUploadId.current,
          serverUploadId: current.mux_upload_id,
          localUploadCompleted: uploadCompleted.current,
        })
      ) {
        setStage('UPLOADING BROADCAST');
        const target = await api<{ url: string; uploadId: string }>(
          `drops/${drop.id}/upload`,
          { replace },
        );
        savedUploadId.current = target.uploadId;
        uploadCompleted.current = false;
        try {
          await saveTake(drop.id, blob, thumbnail, target.uploadId);
        } catch {
          setNotice('Download a backup before leaving this device.');
        }
        setReplace(false);
        const { createUpload } = await import('@mux/upchunk');
        try {
          await new Promise<void>((resolve, reject) => {
            const task = createUpload({
              endpoint: target.url,
              file: new File(
                [blob],
                `broadcast-${drop.id}.${recordingExtension(blob.type)}`,
                { type: blob.type },
              ),
              chunkSize: 5120,
              attempts: 5,
            });
            uploader.current = task;
            task.on('progress', (event) => {
              if (mounted.current) setProgress(event.detail);
            });
            task.on('success', () => resolve());
            task.on('error', () =>
              reject(
                new Error(
                  'Broadcast upload was interrupted. Your payment and recording are saved. Try Submit Broadcast again.',
                ),
              ),
            );
          });
          uploadCompleted.current = true;
          await markTakeUploaded(drop.id, target.uploadId).catch(() => false);
        } finally {
          uploader.current = null;
        }
      }
      setStage('UPLOADING THUMBNAIL');
      const target = await api<{ path: string; token: string }>(
        `drops/${drop.id}/thumbnail`,
        { contentType: thumbnail.type },
      );
      const { error: uploadError } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .uploadToSignedUrl(target.path, target.token, thumbnail, {
          contentType: thumbnail.type,
        });
      if (uploadError)
        throw new Error(
          'Thumbnail upload failed. Your broadcast and payment are saved. Try again.',
        );
      setStage('SUBMITTING YOUR BROADCAST');
      await api(`drops/${drop.id}/submit`, {});
      // Keep the local take through processing/review so a rejected or failed asset can be retaken.
      await refresh();
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Submission failed. Your paid broadcast is saved.',
        );
    } finally {
      if (mounted.current) {
        setBusy(false);
        setStage('');
      }
    }
  }

  if (!restored)
    return (
      <div className="drop-loading">Checking for your saved recording…</div>
    );
  return (
    <>
      <div className="drop-confirmed">
        <ShieldCheck size={28} />
        <div>
          <h2>PAYMENT CONFIRMED</h2>
          <p>Your position is reserved.</p>
        </div>
        <span>01 / PAID</span>
      </div>
      {drop.review_reason && (
        <p className="drop-error" role="alert">
          {drop.review_reason}
        </p>
      )}
      {notice && <p className="drop-notice">{notice}</p>}
      {!blob ? (
        <>
          {drop.capture_mode === 'screen' ? (
            <ScreenRecorder dropId={drop.id} onRecorded={onRecorded} />
          ) : (
            <CameraRecorder dropId={drop.id} onRecorded={onRecorded} />
          )}
          <section className="drop-import-recording">
            <div>
              <strong>
                {drop.capture_mode === 'camera'
                  ? 'NO CAMERA ON THIS COMPUTER?'
                  : 'ALREADY RECORDED YOUR SCREEN?'}
              </strong>
              <p>
                {drop.capture_mode === 'camera'
                  ? 'Record your face and voice on a phone or another device, move the file here, then import it.'
                  : 'You can import a screen recording made in another app instead.'}{' '}
                MP4, MOV, or WebM · 1 second–2 minutes · up to 250 MB.
              </p>
            </div>
            <label className={`drop-button ${importing ? 'disabled' : ''}`}>
              <Upload size={16} />
              {importing ? 'CHECKING VIDEO…' : 'IMPORT VIDEO'}
              <input
                className="drop-file-input"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                disabled={importing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importRecording(file);
                  event.target.value = '';
                }}
              />
            </label>
          </section>
        </>
      ) : (
        <>
          <div className="drop-camera drop-recorded">
            <video
              ref={preview}
              src={videoUrl}
              controls
              playsInline
              aria-label="Preview your recorded broadcast"
              onLoadedData={() => {
                if (!thumbnail) void captureFrame();
              }}
            />
            <span className="drop-preview-label">YOUR TAKE</span>
          </div>
          <div className="drop-actions">
            <button
              className="drop-button"
              disabled={busy}
              onClick={() => {
                setBlob(null);
                setThumbnail(null);
                setAccepted(false);
                setReplace(true);
                savedUploadId.current = undefined;
                uploadCompleted.current = false;
                setError('');
                void deleteTake(drop.id).catch(() => {});
              }}
            >
              <RotateCcw size={17} /> RETAKE
            </button>
            <button
              className={`drop-button ${accepted ? 'accepted' : 'primary'}`}
              disabled={busy}
              onClick={() => setAccepted(true)}
            >
              <Check size={17} />
              {accepted ? 'BROADCAST SELECTED' : 'USE THIS BROADCAST'}
            </button>
          </div>
          <a
            className="drop-text-button"
            href={videoUrl}
            download={`broadcast-${drop.id}.${recordingExtension(blob.type)}`}
          >
            Download a backup of this take
          </a>
          {accepted && (
            <section className="drop-thumbnail-section">
              <div className="drop-section-label">
                <span>03 /</span> THUMBNAIL
              </div>
              <p>
                Give the room a first impression. Scrub your broadcast to choose
                a frame.
              </p>
              <div className="drop-thumbnail-picker">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt="Selected broadcast thumbnail"
                    width={1280}
                    height={720}
                    unoptimized
                  />
                ) : (
                  <div className="drop-thumbnail-empty">
                    <ImagePlus size={28} />
                  </div>
                )}
                <div>
                  <label className={`drop-button ${busy ? 'disabled' : ''}`}>
                    <Upload size={16} />
                    UPLOAD THUMBNAIL
                    <input
                      className="drop-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          await chooseThumbnail(await normalizeThumbnail(file));
                          setError('');
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Could not use this image.',
                          );
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    className="drop-button"
                    disabled={busy}
                    onClick={captureFrame}
                  >
                    <Camera size={16} />
                    USE BROADCAST FRAME
                  </button>
                  <small>JPEG, PNG or WebP · Up to 5 MB</small>
                </div>
              </div>
            </section>
          )}
          {error && (
            <p className="drop-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <output className="drop-upload-progress">
              <span>
                {stage}
                <b>{Math.round(progress)}%</b>
              </span>
              <progress max="100" value={progress} />
            </output>
          )}
          {accepted && (
            <>
              <button
                className="drop-button primary drop-submit"
                disabled={busy || !thumbnail}
                onClick={submit}
              >
                {busy ? 'SAVING YOUR BROADCAST…' : 'SUBMIT BROADCAST'}
                <Upload size={18} />
              </button>
              <p className="drop-fineprint">
                Your broadcast is processed and reviewed before it goes live.
                Your rank follows your paid bid; it can change until the auction
                closes.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
