'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  Eye,
  Timer,
  Users,
} from 'lucide-react';
import Link from 'next/link';

const feedItems = [
  ['Rahul K.', 'took #4 in', 'BEEF', '₹6,200', '12s ago'],
  ['Priya M.', 'entered', 'MONEY', '₹4,100', '21s ago'],
  ['Arjun S.', 'moved to #2 in', 'BUILDING', '₹8,900', '31s ago'],
  ['Karan V.', 'outbid in', 'UNPOPULAR OPINION', '₹11,500', '45s ago'],
] as const;

export function MarketStatusStrip({
  eyebrow = 'THE OPEN POSITION',
  title = 'BE THE NEXT #1',
  description = 'Get the most visibility for your message.',
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const [now, setNow] = useState(() => new Date(0));

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => setNow(new Date()));
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(timer);
    };
  }, []);

  const secondsElapsed =
    now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const totalSeconds = 86400 - secondsElapsed;
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

  return (
    <section
      className="dashboard-status-row dashboard-status-panel"
      aria-label="Market status"
    >
      <div className="total-panel dashboard-panel">
        <div>
          <span className="dashboard-eyebrow">TODAY&apos;S TOTAL</span>
          <strong>₹4,71,220</strong>
        </div>
        <div>
          <span className="dashboard-delta">
            <ArrowUpRight size={13} /> +23%
          </span>
          <span>vs yesterday</span>
        </div>
      </div>
      <div className="next-position dashboard-panel">
        <div>
          <span className="dashboard-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="next-position-mark">
          <Bell size={17} />
          <span>EXPOSURE OPEN</span>
        </div>
      </div>
      <div
        className={`status-countdown dashboard-panel ${countdown.totalSeconds < 3600 ? 'is-urgent' : ''}`}
      >
        <div className="countdown-icon">
          <Timer size={40} strokeWidth={1.8} />
        </div>
        <div className="countdown-label">
          <strong>NEXT DROP</strong>
          <span>BIDDING STARTS IN</span>
        </div>
        <div className="countdown-value">
          <strong>
            {countdown.hours} : {countdown.minutes} : {countdown.seconds}
          </strong>
          <span>
            <b>HOURS</b>
            <b>MINUTES</b>
            <b>SECONDS</b>
          </span>
        </div>
      </div>
    </section>
  );
}

export function LiveMarketFeed() {
  return (
    <div className="live-feed dashboard-panel">
      <span className="live-feed-label">
        <i /> LIVE FEED
      </span>
      <div
        className="live-feed-viewport"
        aria-label="Continuously updating live feed"
      >
        <div className="live-feed-track">
          {[...feedItems, ...feedItems].map(
            ([name, action, category, amount, time], index) => (
              <span key={`${name}-${time}-${index}`}>
                <b>{name}</b> {action} <strong>{category}</strong>{' '}
                <em>· {amount}</em> <small>· {time}</small>
              </span>
            ),
          )}
        </div>
      </div>
      <Link href="/watchlist" aria-label="Open live activity">
        <ChevronRight size={15} />
      </Link>
    </div>
  );
}

export function MarketFooter() {
  return (
    <footer className="dashboard-footer">
      <div className="footer-brand">
        <span className="brand-wordmark">BOUGHT</span>
        <span>Real attention. Real opinions. Real value.</span>
      </div>
      <div className="footer-stats">
        <span>
          <BarChart3 size={17} />
          <b>2,843</b>
          <small>Total Drops</small>
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
        <Link href="/how-it-works">About</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/categories">Categories</Link>
        <Link href="/magazine">Magazine</Link>
        <Link href="/field-notes">Notes</Link>
        <Link href="/waitlist">Waitlist</Link>
      </div>
    </footer>
  );
}
