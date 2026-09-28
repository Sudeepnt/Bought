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
  const applyCaptionLanguage = useCallback(() => {
    const tracks = playerRef.current?.textTracks;
    if (!tracks) return;
    const selected = captionLanguageBaseCode(captionLanguage);
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      track.mode =
        captionsEnabled && captionLanguageBaseCode(track.language) === selected
          ? 'showing'
          : 'disabled';
    }
  }, [captionLanguage, captionsEnabled]);
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
      />
    </Suspense>
  );
}
