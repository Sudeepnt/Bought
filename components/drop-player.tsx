'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type MuxPlayerElement from '@mux/mux-player';
import { captionLanguageBaseCode } from '@/lib/caption-languages';
import { useBought } from './bought-provider';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export function DropPlayer({
  dropId,
  onPlayingChange,
  onAspectRatioChange,
  onProgressChange,
  muted,
  captionLanguage = 'en',
  captionsEnabled = true,
}: {
  dropId: string;
  onPlayingChange?: (playing: boolean) => void;
  onAspectRatioChange?: (width: number, height: number) => void;
  onProgressChange?: (current: number, duration: number) => void;
  muted?: boolean;
  captionLanguage?: string;
  captionsEnabled?: boolean;
}) {
  const { api } = useBought();
  const playerRef = useRef<MuxPlayerElement>(null);
  const [media, setMedia] = useState<{
    playbackId: string;
    token: string;
    thumbnail: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [captionTrack, setCaptionTrack] = useState<{
    language: string;
    id: string;
  } | null>(null);
  const [captionStatus, setCaptionStatus] = useState<{
    language: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      api<{
        playbackId: string;
        token: string;
        thumbnail: string;
      }>(`media/${dropId}`)
        .then((result) => {
          if (active) {
            setMedia(result);
            setError('');
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.message);
            setMedia(null);
          }
        });
    void load();
    const timer = window.setInterval(load, 8 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api, dropId]);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const language = captionLanguageBaseCode(captionLanguage);
    if (!captionsEnabled || language === 'en') return;
    const loadCaption = () => {
      if (!active) return;
      setCaptionStatus({
        language,
        message: 'Preparing selected captions…',
      });
      void api<{ state: 'ready' | 'processing'; trackId: string | null }>(
        `media/${dropId}/captions`,
        { language },
      )
        .then((result) => {
          if (!active) return;
          if (result.state === 'ready' && result.trackId) {
            setCaptionTrack({ language, id: result.trackId });
            setCaptionStatus(null);
            return;
          }
          timer = window.setTimeout(loadCaption, 8_000);
        })
        .catch(() => {
          if (!active) return;
          setCaptionTrack(null);
          setCaptionStatus({
            language,
            message: 'These captions are not available yet.',
          });
        });
    };
    timer = window.setTimeout(loadCaption, 0);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [api, captionLanguage, captionsEnabled, dropId]);
  const selectedCaptionLanguage = captionLanguageBaseCode(captionLanguage);
  const captionTrackId =
    captionsEnabled && captionTrack?.language === selectedCaptionLanguage
      ? captionTrack.id
      : null;
  const captionStatusMessage =
    captionsEnabled && captionStatus?.language === selectedCaptionLanguage
      ? captionStatus.message
      : '';
  const applyCaptionLanguage = useCallback(() => {
    const tracks = playerRef.current?.textTracks;
    if (!tracks) return;
    const selected = captionLanguageBaseCode(captionLanguage);
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      track.mode =
        captionsEnabled &&
        captionLanguageBaseCode(track.language) === selected &&
        (!captionTrackId || track.label.startsWith('BOUGHT '))
          ? 'showing'
          : 'disabled';
    }
  }, [captionLanguage, captionTrackId, captionsEnabled]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(applyCaptionLanguage);
    return () => window.cancelAnimationFrame(frame);
  }, [applyCaptionLanguage, media]);
  if (error)
    return (
      <p className="drop-error" role="alert">
        {error}
      </p>
    );
  if (!media)
    return <div className="drop-player-loading">Loading broadcast…</div>;
  return (
    <div className="drop-player-shell">
      <Suspense
        fallback={<div className="drop-player-loading">Opening player…</div>}
      >
        <MuxPlayer
          ref={playerRef}
          playbackId={media.playbackId}
          tokens={{ playback: media.token }}
          poster={media.thumbnail}
          accentColor="#ef2b32"
          streamType="on-demand"
          muted={muted}
          onPlaying={() => onPlayingChange?.(true)}
          onPause={() => onPlayingChange?.(false)}
          onEnded={() => onPlayingChange?.(false)}
          onTimeUpdate={(event) => {
            const player = event.currentTarget as MuxPlayerElement;
            onProgressChange?.(player.currentTime, player.duration);
          }}
          onDurationChange={(event) => {
            const player = event.currentTarget as MuxPlayerElement;
            onProgressChange?.(player.currentTime, player.duration);
          }}
          onLoadedMetadata={(event) => {
            const player = event.currentTarget as MuxPlayerElement | null;
            if (player) {
              onAspectRatioChange?.(player.videoWidth, player.videoHeight);
              onProgressChange?.(player.currentTime, player.duration);
              applyCaptionLanguage();
            }
          }}
          defaultHiddenCaptions={false}
          metadata={{ video_id: dropId, video_title: 'BOUGHT broadcast' }}
        >
          {captionTrackId && (
            <track
              key={captionTrackId}
              kind="subtitles"
              src={`https://stream.mux.com/${encodeURIComponent(media.playbackId)}/text/${encodeURIComponent(captionTrackId)}.vtt?token=${encodeURIComponent(media.token)}`}
              srcLang={captionLanguageBaseCode(captionLanguage)}
              label={`BOUGHT ${captionLanguageBaseCode(captionLanguage)}`}
              onLoad={applyCaptionLanguage}
            />
          )}
        </MuxPlayer>
      </Suspense>
      {captionStatusMessage && (
        <output className="drop-caption-status">{captionStatusMessage}</output>
      )}
    </div>
  );
}
