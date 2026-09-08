'use client';

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
import { useBought } from './bought-provider';
import { money } from '@/lib/drop-domain';

export function MarketStatusStrip({
  eyebrow = 'THE OPEN POSITION',
  title = 'BE THE NEXT #1',
  description = 'Get the most visibility for your message.',
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const { market, serverTime, marketFresh, entries } = useBought();
  const totalSeconds = market && serverTime ? Math.max(0, Math.floor((Date.parse(market.phase === 'bidding' ? market.closesAt : market.exposureEndsAt) - serverTime) / 1000)) : 0;
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
  const exposureLocked = marketFresh && market?.phase === 'exposure';

  return (
    <section
      className="dashboard-status-row dashboard-status-panel"
      aria-label="Market status"
    >
      <div className="total-panel dashboard-panel">
        <div>
          <span className="dashboard-eyebrow">TODAY&apos;S TOTAL</span>
          <strong>{money(entries.reduce((sum, entry) => sum + entry.amount_minor, 0))}</strong>
        </div>
        <div>
          <span className="dashboard-delta">
            <ArrowUpRight size={13} /> {entries.length} BROADCASTS
          </span>
          <span>verified & published</span>
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
          <Link href="/drop">MAKE A BROADCAST</Link>
        </div>
      </div>
      <div
        className={`status-countdown dashboard-panel ${countdown.totalSeconds < 3600 ? 'is-urgent' : ''}`}
      >
        <div className="countdown-icon">
          <Timer size={40} strokeWidth={1.8} />
        </div>
        <div className="countdown-label">
          <strong>{exposureLocked ? 'FINAL POSITIONS' : 'NEXT DROP'}</strong>
          <span>{exposureLocked ? 'EXPOSURE LOCKED' : 'BIDDING CLOSES IN'}</span>
        </div>
        <div className="countdown-value">
          <strong>
            {marketFresh ? `${countdown.hours} : ${countdown.minutes} : ${countdown.seconds}` : '-- : -- : --'}
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
  const { entries } = useBought();
  const feedItems = entries.slice(0, 8).map(entry => [entry.title, 'entered', entry.category, money(entry.amount_minor), `#${entry.position}`]);
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
          {feedItems.length === 0 && <span>Verified broadcasts will appear here as they are published. <Link href="/drop">MAKE YOUR BROADCAST ↗</Link></span>}
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
      <Link href="/ladder" aria-label="Open live ladder">
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
        <Link href="/how-it-works">About</Link>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/categories">Categories</Link>
        <Link href="/magazine">Magazine</Link>
      </div>
    </footer>
  );
}
