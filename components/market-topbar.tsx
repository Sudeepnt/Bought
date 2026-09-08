'use client';

import { useEffect, useState } from 'react';
import { Moon, Search, Sun, WalletCards } from 'lucide-react';
import Link from 'next/link';

import { ProfileAvatar } from '@/components/profile-avatar';
import { useBought } from './bought-provider';
import { money } from '@/lib/drop-domain';

export type MarketPage =
  | 'floor'
  | 'index'
  | 'watchlist'
  | 'magazine'
  | 'rules'
  | 'categories'
  | 'drop'
  | 'ladder'
  | 'review';

const navigation: Array<{ key: MarketPage; label: string; href: string }> = [
  { key: 'floor', label: 'TODAY', href: '/' },
  { key: 'ladder', label: 'GLOBAL LADDER', href: '/ladder' },
  { key: 'index', label: 'ALL-TIME', href: '/global-index' },
  { key: 'categories', label: 'CATEGORIES', href: '/categories' },
  { key: 'watchlist', label: 'WATCHLIST', href: '/watchlist' },
  { key: 'magazine', label: 'MAGAZINE', href: '/magazine' },
  { key: 'rules', label: 'HOW IT WORKS', href: '/how-it-works' },
];

function utcTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function MarketTopbar({
  active,
  activityItems = [],
}: {
  active: MarketPage;
  activityItems?: string[];
}) {
  const { market, serverTime, marketFresh, entries, session } = useBought();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isLive = marketFresh && market?.phase === 'bidding';
  const liveActivity = activityItems.length
    ? activityItems.map((item) => `LIVE ACTIVITY / ${item}`)
    : entries.slice(0, 8).map(
        (entry) =>
          `LIVE / ${entry.title} took #${entry.position} in ${entry.category} ${money(entry.amount_minor)}`,
      );
  const tickerItems = [
    'BIDDING 00:00–12:00 UTC',
    'EXPOSURE 12:00–00:00 UTC',
    'ONE GLOBAL LADDER',
    ...liveActivity,
  ];
  const tickerLoop = Array.from({ length: 6 }, () => tickerItems).flat();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedTheme = window.localStorage.getItem('bought-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bought-theme', theme);
  }, [theme]);

  return (
    <>
      <header className="topbar">
        <Link className="brand-mark" href="/" aria-label="BOUGHT home">
          <span className="brand-dot" />
          <span>BOUGHT</span>
        </Link>

        <nav className="top-navigation" aria-label="Market pages">
          {navigation.map((item, index) => (
            <Link
              className={`top-navigation-link ${active === item.key ? 'is-active' : ''}`}
              href={item.href}
              key={`${item.label}-${index}`}
              aria-current={
                active === item.key && item.label !== 'PRICE INDEX'
                  ? 'page'
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-right">
          <search className="topbar-search">
            <Search size={15} />
            <span>Search broadcasts, people, companies...</span>
          </search>
          <div className="online-status">
            <i /> {entries.length} published
          </div>

          <div className="topbar-actions">
            <div className="topbar-status" aria-live="polite">
              <span
                className={`status-dot ${isLive ? 'is-live' : 'is-locked'}`}
              />
              {!marketFresh ? 'SYNCING' : isLive ? 'LIVE' : 'LOCKED'}
            </div>
            <div className="clock-readout">
              <span className="eyebrow">UTC</span>
              <time>
                {serverTime && marketFresh
                  ? utcTime(new Date(serverTime))
                  : '--:--:--'}
              </time>
            </div>
            <button
              className="theme-toggle"
              type="button"
              onClick={() =>
                setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
              }
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="wallet-button" type="button">
              <WalletCards size={14} />$18,600
            </button>
          </div>

          <ProfileAvatar
            initials={session?.user.email?.slice(0, 2).toUpperCase() ?? 'BT'}
            className="header-avatar"
            alt="Account profile"
          />
        </div>
      </header>

      <div className="ticker" aria-label="Live market tape">
        <div className="ticker-track">
          {[...tickerLoop, ...tickerLoop].map((item, index) => (
            <span key={`${item}-${index}`} className="ticker-item">
              <span className="ticker-bullet">◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
