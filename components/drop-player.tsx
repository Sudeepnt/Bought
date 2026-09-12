'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { useBought } from './bought-provider';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export function DropPlayer({ dropId }: { dropId: string }) {
  const { api } = useBought();
  const [media, setMedia] = useState<{
    playbackId: string;
    token: string;
    thumbnail: string;
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ playbackId: string; token: string; thumbnail: string }>(
        `media/${dropId}`,
      )
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
        metadata={{ video_id: dropId, video_title: 'BOUGHT broadcast' }}
      />
    </Suspense>
  );
}
