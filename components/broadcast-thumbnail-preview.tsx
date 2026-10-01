'use client';

/* oxlint-disable jsx-a11y/media-has-caption -- This silent thumbnail preview is decorative; the full player has captions. */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type MuxPlayerElement from '@mux/mux-player';
import { useBought } from './bought-provider';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));
const PREVIEW_SECONDS = 10;
const REPLAY_DELAY_MS = 5_000;

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
  const replayTimerRef = useRef<number | null>(null);
  const waitingToReplayRef = useRef(false);
  const [ready, setReady] = useState(false);
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

  useEffect(() => () => {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    waitingToReplayRef.current = false;
  }, [active, dropId, demoSource]);

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

  function pauseThenReplay() {
    if (waitingToReplayRef.current) return;
    waitingToReplayRef.current = true;
    const player = muxRef.current ?? videoRef.current;
    player?.pause();
    replayTimerRef.current = window.setTimeout(() => {
      replayTimerRef.current = null;
      const currentPlayer = muxRef.current ?? videoRef.current;
      if (!currentPlayer) return;
      currentPlayer.currentTime = 0;
      waitingToReplayRef.current = false;
      void currentPlayer.play().catch(() => {
        // A browser may block autoplay; leave the preview still without an error.
      });
    }, REPLAY_DELAY_MS);
  }

  function stopAtTenSeconds(currentTime: number) {
    if (currentTime >= PREVIEW_SECONDS) pauseThenReplay();
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
      {ready && dropId && media ? (
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
            onEnded={pauseThenReplay}
          />
        </Suspense>
      ) : ready && !dropId ? (
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
          onEnded={pauseThenReplay}
        />
      ) : null}
    </div>
  );
}
