'use client';

import {
  ArrowUpRight,
  BarChart3,
  Eye,
  LockKeyhole,
  Timer,
  Users,
} from 'lucide-react';
import Link from '@/components/site-link';
import { useEffect, useState, type RefObject } from 'react';
import { BrandLogo } from './brand-logo';
import { useBought } from './bought-provider';
import { money } from '@/lib/drop-domain';
import '@/app/today.css';

type FeedItem = readonly [
  name: string,
  action: string,
  category: string,
  amount: string,
  time: string,
];

const MARKET_MARQUEE_PIXELS_PER_SECOND = 60;
export const FALLBACK_BOARD_TOTAL_MINOR = 5_530_000;
export const FALLBACK_BOARD_BROADCASTS = 10;

export function useMarketCountdown() {
  const { market, serverTime, marketFresh, entries } = useBought();
  const [previewSeconds, setPreviewSeconds] = useState<number | null>(null);

  useEffect(() => {
    const criticalPreview =
      process.env.NODE_ENV === 'development' &&
      new URLSearchParams(window.location.search).get('countdown') ===
        'critical';
    if (!criticalPreview) return;

    const frame = window.requestAnimationFrame(() => setPreviewSeconds(582));
    const timer = window.setInterval(
      () =>
        setPreviewSeconds((current) =>
          current === null ? null : Math.max(0, current - 1),
        ),
      1000,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  const marketSeconds =
    market && serverTime !== null
      ? Math.max(
          0,
          Math.floor(
            (Date.parse(
              market.phase === 'bidding'
                ? market.closesAt
                : market.exposureEndsAt,
            ) -
              serverTime) /
              1000,
          ),
        )
      : 0;
  const totalSeconds = previewSeconds ?? marketSeconds;
  const countdown = {
    totalSeconds,
    hours: Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, '0'),
    minutes: Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0'),
    seconds: (totalSeconds % 60).toString().padStart(2, '0'),
  };
  const countdownReady = market !== null && serverTime !== null;
  const exposureLocked = market?.phase === 'exposure';

  return {
    countdown,
    countdownReady,
    countdownIsCritical: marketFresh && countdown.totalSeconds < 600,
    countdownIsUrgent: marketFresh && countdown.totalSeconds < 3600,
    entries,
    exposureLocked,
    marketFresh,
  };
}

export function BidClock({
  countdown,
  countdownReady,
  exposureLocked,
  className = '',
}: {
  countdown: { hours: string; minutes: string; seconds: string };
  countdownReady: boolean;
  exposureLocked: boolean;
  className?: string;
}) {
  return (
    <div className={`bid-clock ${className}`}>
      <span className="bid-clock-icon" aria-hidden="true">
        {exposureLocked ? (
          <LockKeyhole size={34} strokeWidth={1.8} />
        ) : (
          <Timer size={34} strokeWidth={1.8} />
        )}
      </span>
      <div className="bid-clock-text">
        <span className="bid-clock-kicker">
          {exposureLocked ? 'Final positions' : 'Bidding closes in'}
        </span>
        <strong
          className="bid-clock-time"
          aria-label={
            countdownReady
              ? `${countdown.hours} hours ${countdown.minutes} minutes ${countdown.seconds} seconds`
              : 'Syncing'
          }
        >
          {countdownReady
            ? `${countdown.hours}:${countdown.minutes}:${countdown.seconds}`
            : '--:--:--'}
        </strong>
        <small>
          {exposureLocked ? 'Exposure locked' : 'Hours · minutes · seconds'}
        </small>
      </div>
    </div>
  );
}

export function useMarqueeDuration(trackRef: RefObject<HTMLElement | null>) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateDuration = () => {
      const travelDistance = track.scrollWidth / 2;
      if (travelDistance > 0) {
        setDuration(travelDistance / MARKET_MARQUEE_PIXELS_PER_SECOND);
      }
    };

    updateDuration();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateDuration);
    observer.observe(track);
    return () => observer.disconnect();
  }, [trackRef]);

  return duration ? `${duration}s` : undefined;
}

export const fallbackFeedItems: FeedItem[] = [
  ['Ananya Rao', 'took #1 in', 'UNPOPULAR OPINION', '$11,400', 'now'],
  ['Rahul Kapoor', 'raised the amount in', 'PRODUCT LAUNCH', '$6,200', '8s ago'],
  ['Priya Mehta', 'shared an opinion on', 'MONEY', '', '14s ago'],
  ['Arjun Sharma', 'claimed #2 in', 'BUILDING', '$8,900', '21s ago'],
  ['Karan Verma', 'was outbid in', 'UNPOPULAR OPINION', '$11,500', '29s ago'],
  ['Maya Khanna', 'published a broadcast in', 'I WAS WRONG', '$4,200', '36s ago'],
  ['Dev Patel', 'joined the market in', 'THE PITCH THAT GOT REJECTED', '$3,900', '43s ago'],
  ['Simran Nair', 'shared an opinion on', 'MONEY I SET ON FIRE', '', '51s ago'],
  ['Kabir Joshi', 'climbed to #3 in', 'BUILDING', '$3,200', '1m ago'],
  ['Aisha Thomas', 'set an amount in', 'CONFESSIONS', '$2,900', '1m ago'],
  ['Nia P.', 'took the lead in', 'CONFESSIONS', '$5,700', '2m ago'],
  ['Jon B.', 'had a broadcast approved in', 'BUILDING', '$2,600', '2m ago'],
  ['Rhea D.', 'replied to a broadcast in', 'MONEY I SET ON FIRE', '', '3m ago'],
  ['Leo M.', 'moved into the top five in', 'PRODUCT LAUNCH', '$2,300', '3m ago'],
];

export function TodayBar() {
  const { entries } = useBought();
  const { countdown, countdownReady, exposureLocked } = useMarketCountdown();
  const totalAmount =
    entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.amount_minor, 0)
      : FALLBACK_BOARD_TOTAL_MINOR;
  const broadcastCount =
    entries.length > 0 ? entries.length : FALLBACK_BOARD_BROADCASTS;

  return (
    <section className="today-bar" aria-label="Auction status">
      <div className="today-bar-cell">
        <span className="today-kicker">Bids placed today</span>
        <strong className="today-figure">{money(totalAmount)}</strong>
        <small>
          {broadcastCount} {broadcastCount === 1 ? 'broadcast' : 'broadcasts'}
        </small>
      </div>
      <div className="today-bar-cell today-bar-action">
        <span className="today-kicker">Your turn</span>
        <Link className="today-cta" href="/broadcast">
          Make a broadcast <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="today-bar-cell today-bar-clock">
        <BidClock
          className="today-bid-clock"
          countdown={countdown}
          countdownReady={countdownReady}
          exposureLocked={exposureLocked}
        />
      </div>
    </section>
  );
}

export function FloatingMarketCountdown({ visible }: { visible: boolean }) {
  const { countdown, countdownReady, exposureLocked } = useMarketCountdown();

  return (
    <aside
      className={`floating-market-countdown ${visible ? 'is-visible' : ''}`}
      aria-label="Persistent market countdown"
      aria-hidden={!visible}
    >
      <BidClock
        countdown={countdown}
        countdownReady={countdownReady}
        exposureLocked={exposureLocked}
      />
    </aside>
  );
}

export function MarketFooter() {
  return (
    <footer className="dashboard-footer">
      <div className="footer-brand">
        <BrandLogo className="brand-logo-footer" />
        <span>Real attention. Real opinions. Real value.</span>
      </div>
      <div className="footer-stats">
        <span>
          <BarChart3 size={17} />
          <b>2,843</b>
          <small>Total Broadcasts</small>
        </span>
        <span>
          <Eye size={17} />
          <b>1,27,500</b>
          <small>Total Views</small>
        </span>
        <span>
          <Users size={17} />
          <b>8,410</b>
          <small>Active Users</small>
        </span>
      </div>
      <div className="footer-links">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/categories">Categories</Link>
        <Link href="/newspaper">Newspaper</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
