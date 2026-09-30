'use client';

/* oxlint-disable jsx-a11y/media-has-caption -- This silent thumbnail preview is decorative; the full player has captions. */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type MuxPlayerElement from '@mux/mux-player';
import { useBought } from './bought-provider';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));
const PREVIEW_SECONDS = 10;

export function BroadcastThumbnailPreview({
  active,
  delayMs,
  dropId,
  demoSource,
}: {
  active: boolean;
  delayMs: number;
  dropId: string | null;
  demoSource: string;
}) {
  const { api } = useBought();
  const muxRef = useRef<MuxPlayerElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [media, setMedia] = useState<{
    playbackId: string;
    token: string;
    thumbnail: string;
  } | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  useEffect(() => {
    if (!active || !dropId) return;
    let current = true;
    void api<{
      playbackId: string;
      token: string;
      thumbnail: string;
    }>(`media/${dropId}`)
      .then((result) => {
        if (current) setMedia(result);
      })
      .catch(() => {
        // The still thumbnail remains visible if this broadcast is unavailable.
      });
    return () => {
      current = false;
    };
  }, [active, api, dropId]);

  if (!active || (dropId && !media)) return null;

  function stopAtTenSeconds(currentTime: number) {
    if (currentTime < PREVIEW_SECONDS) return;
    muxRef.current?.pause();
    videoRef.current?.pause();
    setFinished(true);
  }

  return (
    <div
      className="broadcast-thumbnail-preview"
      aria-hidden="true"
      style={
        media?.thumbnail
          ? { backgroundImage: `url(${media.thumbnail})` }
          : undefined
      }
    >
      {ready && !finished && dropId && media ? (
        <Suspense fallback={null}>
          <MuxPlayer
            ref={muxRef}
            playbackId={media.playbackId}
            tokens={{ playback: media.token }}
            poster={media.thumbnail}
            streamType="on-demand"
            autoPlay
            muted
            playsInline
            preload="metadata"
            onTimeUpdate={(event) =>
              stopAtTenSeconds(
                (event.currentTarget as MuxPlayerElement | null)?.currentTime ?? 0,
              )
            }
            onEnded={() => setFinished(true)}
          />
        </Suspense>
      ) : ready && !finished && !dropId ? (
        <video
          ref={videoRef}
          src={demoSource}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={(event) =>
            stopAtTenSeconds(event.currentTarget.currentTime)
          }
          onEnded={() => setFinished(true)}
        />
      ) : null}
    </div>
  );
}
