'use client';

import { useEffect, useState } from 'react';
import { Moon, Search, Sun, WalletCards } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/profile-avatar';

export type MarketPage =
  | 'floor'
  | 'index'
  | 'watchlist'
  | 'magazine'
  | 'notes'
  | 'rules'
  | 'categories';

const navigation: Array<{ key: MarketPage; label: string; href: string }> = [
  { key: 'floor', label: 'TODAY', href: '/' },
  { key: 'index', label: 'ALL-TIME', href: '/global-index' },
  { key: 'categories', label: 'CATEGORIES', href: '/categories' },
  { key: 'watchlist', label: 'TRIBES', href: '/watchlist' },
  { key: 'index', label: 'PRICE INDEX', href: '/global-index' },
  { key: 'rules', label: 'HOW IT WORKS', href: '/how-it-works' },
];

const tickerItems = [
  'GLOBAL LADDER +1.8%',
  'UO / ANANYA RAO ₹11,400',
  '24.8K WATCHING THE FLOOR',
  'NEXT DROP 00:00 UTC',
  'NEW POSITION: @MARCUSK',
  'BIP / ETHAN COLE ₹9,100',
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
  balance = 18600,
}: {
  active: MarketPage;
  balance?: number;
}) {
  const [now, setNow] = useState(() => new Date(0));
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isLive = now.getUTCHours() < 12;

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('bought-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bought-theme', theme);
  }, [theme]);

  return (
    <>
      <header className="topbar">
        <a className="brand-mark" href="/" aria-label="BOUGHT home">
          <span className="brand-dot" />
          <span>BOUGHT</span>
        </a>

        <nav className="top-navigation" aria-label="Market pages">
          {navigation.map((item, index) => (
            <a
              className={`top-navigation-link ${active === item.key ? 'is-active' : ''}`}
              href={item.href}
              key={`${item.label}-${index}`}
              aria-current={active === item.key && item.label !== 'PRICE INDEX' ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="topbar-search" role="search">
          <Search size={15} />
          <span>Search drops, people, companies...</span>
        </div>
        <div className="online-status"><i /> 412 online</div>
        <ProfileAvatar initials="SK" className="header-avatar" alt="Account profile" />

        <div className="topbar-actions">
          <div className="topbar-status" aria-live="polite">
            <span className={`status-dot ${isLive ? 'is-live' : 'is-locked'}`} />
            {isLive ? 'LIVE' : 'LOCKED'}
          </div>
          <div className="clock-readout">
            <span className="eyebrow">UTC</span>
            <time>{utcTime(now)}</time>
          </div>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Button className="wallet-button" variant="outline" size="sm">
            <WalletCards size={14} />₹{balance.toLocaleString('en-IN')}
          </Button>
        </div>
      </header>

      <div className="ticker" aria-label="Live market tape">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, index) => (
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
