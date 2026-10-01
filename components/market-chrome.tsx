'use client';

import {
  ArrowUpRight,
  BarChart3,
  Eye,
  LockKeyhole,
  Radio,
  Timer,
  Users,
} from 'lucide-react';
import Link from '@/components/site-link';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { BrandLogo } from './brand-logo';
import { useBought } from './bought-provider';
import { money } from '@/lib/drop-domain';

type FeedItem = readonly [
  name: string,
  action: string,
  category: string,
  amount: string,
  time: string,
];

const MARKET_MARQUEE_PIXELS_PER_SECOND = 60;
const FALLBACK_BOARD_TOTAL_MINOR = 5_530_000;
const FALLBACK_BOARD_BROADCASTS = 10;

function useMarketCountdown() {
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
  const countdownReady = marketFresh && market !== null && serverTime !== null;
  const exposureLocked = countdownReady && market.phase === 'exposure';

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

function CountdownSegments({
  countdown,
  countdownReady,
}: {
  countdown: { hours: string; minutes: string; seconds: string };
  countdownReady: boolean;
}) {
  return (
    <div className="countdown-segments">
      <span className="countdown-segment">
        <strong>{countdownReady ? countdown.hours : '--'}</strong>
        <small>HOURS</small>
      </span>
      <strong className="countdown-separator" aria-hidden="true">
        :
      </strong>
      <span className="countdown-segment is-pulsing">
        <strong>{countdownReady ? countdown.minutes : '--'}</strong>
        <small>MINUTES</small>
      </span>
      <strong className="countdown-separator" aria-hidden="true">
        :
      </strong>
      <span className="countdown-segment is-pulsing">
        <strong>{countdownReady ? countdown.seconds : '--'}</strong>
        <small>SECONDS</small>
      </span>
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

export function MarketStatusStrip({
  eyebrow = 'THE OPEN POSITION',
  title = 'BE THE NEXT #1',
}: {
  eyebrow?: string;
  title?: string;
}) {
  const {
    countdown,
    countdownReady,
    countdownIsCritical,
    countdownIsUrgent,
    entries,
    exposureLocked,
  } = useMarketCountdown();
  const hasPublishedEntries = entries.length > 0;
  const totalAmount = hasPublishedEntries
    ? entries.reduce((sum, entry) => sum + entry.amount_minor, 0)
    : FALLBACK_BOARD_TOTAL_MINOR;
  const broadcastCount = hasPublishedEntries
    ? entries.length
    : FALLBACK_BOARD_BROADCASTS;

  return (
    <section
      className="dashboard-status-row dashboard-status-panel"
      aria-label="Market status"
    >
      <div className="total-panel dashboard-panel">
        <div>
          <span className="dashboard-eyebrow">TODAY&apos;S TOTAL</span>
          <strong>{money(totalAmount)}</strong>
        </div>
        <div>
          <span className="dashboard-delta">
            <ArrowUpRight size={13} /> {broadcastCount} BROADCASTS
          </span>
        </div>
      </div>
      <div className="next-position dashboard-panel">
        <div>
          <span className="dashboard-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <div className="next-position-mark">
          <Radio size={17} />
          <Link href="/broadcast">MAKE A BROADCAST</Link>
        </div>
      </div>
      <div
        className={`status-countdown dashboard-panel ${countdownIsUrgent ? 'is-urgent' : ''} ${countdownIsCritical ? 'is-critical' : ''}`}
      >
        <div className="countdown-icon">
          {!countdownReady ? null : exposureLocked ? (
            <LockKeyhole size={40} strokeWidth={1.8} />
          ) : (
            <Timer size={40} strokeWidth={1.8} />
          )}
        </div>
        <div className="countdown-label">
          <strong>{!countdownReady ? 'MARKET STATUS' : exposureLocked ? 'FINAL POSITIONS' : 'NEXT DROP'}</strong>
          <span>
            {!countdownReady ? 'SYNCING' : exposureLocked ? 'EXPOSURE LOCKED' : 'MARKET CLOSES IN'}
          </span>
        </div>
        <div className="countdown-value">
          <CountdownSegments
            countdown={countdown}
            countdownReady={countdownReady}
          />
        </div>
      </div>
    </section>
  );
}

export function FloatingMarketCountdown({ visible }: { visible: boolean }) {
  const { countdown, countdownReady, exposureLocked } = useMarketCountdown();
  const showCountdown = visible && countdownReady;

  return (
    <aside
      className={`floating-market-countdown ${showCountdown ? 'is-visible' : ''}`}
      aria-label={!countdownReady ? 'Market status syncing' : exposureLocked ? 'Exposure locked, final positions countdown' : 'Next drop countdown'}
      aria-hidden={!showCountdown}
    >
      <span className="floating-market-countdown-icon" aria-hidden="true">
        {!countdownReady ? null : exposureLocked ? (
          <LockKeyhole size={28} strokeWidth={1.8} />
        ) : (
          <Timer size={28} strokeWidth={1.8} />
        )}
      </span>
      <div className="countdown-label floating-market-countdown-label">
        <strong>{!countdownReady ? 'MARKET STATUS' : exposureLocked ? 'FINAL POSITIONS' : 'NEXT DROP'}</strong>
        <span>
          {!countdownReady ? 'SYNCING' : exposureLocked ? 'EXPOSURE LOCKED' : 'MARKET CLOSES IN'}
        </span>
      </div>
      <div className="countdown-value floating-market-countdown-time">
        <CountdownSegments
          countdown={countdown}
          countdownReady={countdownReady}
        />
      </div>
    </aside>
  );
}

export function LiveMarketFeed() {
  const { entries } = useBought();
  const trackRef = useRef<HTMLDivElement>(null);
  const marqueeDuration = useMarqueeDuration(trackRef);
  const publishedFeedItems: FeedItem[] = entries
    .slice(0, 8)
    .map((entry) => [
      entry.title,
      entry.position === 1 ? 'took #1 in' : `took #${entry.position} in`,
      entry.category,
      entry.amount_minor > 0 ? money(entry.amount_minor) : 'FREE ENTRY',
      'just now',
    ]);
  const feedItems = [...publishedFeedItems, ...fallbackFeedItems].slice(0, 14);
  const feedLoop = [...feedItems, ...feedItems];

  return (
    <div className="live-feed dashboard-panel">
      <span className="live-feed-label">
        <i /> LIVE FEED
      </span>
      <div
        className="live-feed-viewport"
        aria-label="Continuously updating live feed"
      >
        <div
          className="live-feed-track"
          ref={trackRef}
          style={
            marqueeDuration ? { animationDuration: marqueeDuration } : undefined
          }
        >
          {feedLoop.map(([name, action, category, amount, time], index) => (
            <span
              aria-hidden={index >= feedItems.length ? true : undefined}
              key={`${name}-${action}-${time}-${index}`}
            >
              <b>{name}</b> {action} <strong>{category}</strong>
              {amount && <em> · {amount}</em>}
              <small> · {time}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
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
        <Link href="/magazine">Magazine</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
