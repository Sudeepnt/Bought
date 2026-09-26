'use client';

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type MuxPlayerElement from '@mux/mux-player';
import { useBought } from './bought-provider';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export function DropPlayer({
  dropId,
  onPlayingChange,
  onAspectRatioChange,
  onProgressChange,
}: {
  dropId: string;
  onPlayingChange?: (playing: boolean) => void;
  onAspectRatioChange?: (width: number, height: number) => void;
  onProgressChange?: (current: number, duration: number) => void;
}) {
  const { api } = useBought();
  const [media, setMedia] = useState<{
    playbackId: string;
    token: string;
    thumbnail: string;
    captionsVtt: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () =>
      api<{
        playbackId: string;
        token: string;
        thumbnail: string;
        captionsVtt: string | null;
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
  const captionUrl = useMemo(
    () =>
      media?.captionsVtt
        ? URL.createObjectURL(
            new Blob([media.captionsVtt], { type: 'text/vtt' }),
          )
        : null,
    [media],
  );
  useEffect(
    () => () => {
      if (captionUrl) URL.revokeObjectURL(captionUrl);
    },
    [captionUrl],
  );
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
        playbackId={media.playbackId}
        tokens={{ playback: media.token }}
        poster={media.thumbnail}
        accentColor="#ef2b32"
        streamType="on-demand"
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
          }
        }}
        defaultHiddenCaptions={false}
        metadata={{ video_id: dropId, video_title: 'BOUGHT broadcast' }}
      >
        {captionUrl && (
          <track
            default
            kind="subtitles"
            src={captionUrl}
            srcLang="en"
            label="English"
          />
        )}
      </MuxPlayer>
    </Suspense>
  );
}
