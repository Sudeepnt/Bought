'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from 'react';
import { Moon, Search, Sun, WalletCards } from 'lucide-react';
import Link from '@/components/site-link';

import { ProfileAvatar } from '@/components/profile-avatar';
import { BrandLogo } from '@/components/brand-logo';
import { useBought } from './bought-provider';
import {
  fallbackFeedItems,
  LiveMarketFeed,
  MarketStatusStrip,
  useMarqueeDuration,
} from './market-chrome';
import { money } from '@/lib/drop-domain';
import { searchResults } from '@/lib/search';

export type MarketPage =
  | 'floor'
  | 'watchlist'
  | 'magazine'
  | 'rules'
  | 'categories'
  | 'broadcast'
  | 'review'
  | 'profile'
  | 'terms';

const navigation: Array<{ key: MarketPage; label: string; href: string }> = [
  { key: 'floor', label: 'TODAY', href: '/' },
  { key: 'categories', label: 'CATEGORIES', href: '/categories' },
  { key: 'magazine', label: 'MAGAZINE', href: '/magazine' },
  { key: 'watchlist', label: 'WATCHLIST', href: '/watchlist' },
  { key: 'rules', label: 'HOW IT WORKS', href: '/how-it-works' },
];

type Theme = 'dark' | 'light';

const themeChangeEvent = 'bought-theme-change';

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

function getStoredTheme(): Theme {
  return window.localStorage.getItem('bought-theme') === 'light'
    ? 'light'
    : 'dark';
}

function getServerTheme(): Theme {
  return 'dark';
}

function utcTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function MarketTopbar({ active }: { active: MarketPage }) {
  const { market, serverTime, marketFresh, entries, session } = useBought();
  const searchWrapRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const marqueeDuration = useMarqueeDuration(tickerTrackRef);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCompactOpen, setSearchCompactOpen] = useState(false);
  const matchingResults = useMemo(
    () => searchResults(searchQuery).slice(0, 6),
    [searchQuery],
  );
  // React uses the server snapshot during hydration, then applies the saved
  // preference from localStorage once the client is mounted.
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getStoredTheme,
    getServerTheme,
  );
  const isLive = marketFresh && market?.phase === 'bidding';
  const liveActivity = entries.length
    ? entries.slice(0, 8).map(
        (entry) =>
          `LIVE ACTIVITY / ${entry.title} took #${entry.position} in ${entry.category} ${money(entry.amount_minor)}`,
      )
    : fallbackFeedItems.slice(0, 5).map(
        ([name, action, category, amount, time]) =>
          `LIVE ACTIVITY / ${name} ${action} ${category}${amount ? ` ${amount}` : ''} ${time}`,
      );
  const tickerItems = [
    'BIDDING 00:00–12:00 UTC',
    'EXPOSURE 12:00–00:00 UTC',
    'ONE GLOBAL MARKET',
    ...liveActivity,
  ];
  const tickerLoop = Array.from({ length: 6 }, () => tickerItems).flat();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    function closeSearch(event: MouseEvent) {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setSearchCompactOpen(false);
      }
    }
    document.addEventListener('mousedown', closeSearch);
    return () => document.removeEventListener('mousedown', closeSearch);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('bought-theme', nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    const normalizedQuery = query.toLocaleLowerCase();
    const exactResult = matchingResults.find(
      (result) => result.title.toLocaleLowerCase() === normalizedQuery,
    );
    setSearchOpen(false);
    setSearchCompactOpen(false);
    window.location.assign(
      exactResult?.href ?? `/search?q=${encodeURIComponent(query)}`,
    );
  }

  function openCompactSearch() {
    setSearchCompactOpen(true);
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  return (
    <div className="market-chrome">
      <header className="topbar">
        <Link className="brand-mark" href="/" aria-label="BOUGHT home">
          <span className="brand-dot" />
          <BrandLogo className="brand-logo-topbar" />
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
          <search
            className={`topbar-search-wrap${searchCompactOpen ? ' is-expanded' : ''}`}
            ref={searchWrapRef}
          >
            <button
              className="topbar-search-trigger"
              type="button"
              aria-label="Open search"
              aria-expanded={searchCompactOpen}
              onClick={openCompactSearch}
            >
              <Search size={16} aria-hidden="true" />
            </button>
            <form
              className="topbar-search"
              onSubmit={submitSearch}
            >
              <Search size={15} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder="Search broadcasts…"
                aria-label="Search broadcasts, people, and companies"
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchCompactOpen(false);
                    event.currentTarget.blur();
                  }
                }}
              />
            </form>
            {searchOpen && searchQuery.trim() && (
              <div className="topbar-search-results">
                {matchingResults.length ? (
                  matchingResults.map((result) => (
                    <Link
                      className="topbar-search-result"
                      href={result.href}
                      key={result.id}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchCompactOpen(false);
                      }}
                    >
                      <span className={`search-result-icon is-${result.type}`}>
                        {result.type === 'broadcast'
                          ? '▶'
                          : result.type === 'person'
                            ? '@'
                            : result.type === 'company'
                              ? '◈'
                              : result.type === 'category'
                                ? '#'
                                : '↗'}
                      </span>
                      <span className="search-result-copy">
                        <strong>{result.title}</strong>
                        <small>
                          {result.subtitle} · {result.meta}
                        </small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <span className="topbar-search-empty">
                    No matches yet. Press Enter to search the full market.
                  </span>
                )}
                <button
                  className="topbar-search-all"
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchCompactOpen(false);
                    window.location.assign(
                      `/search?q=${encodeURIComponent(searchQuery.trim())}`,
                    );
                  }}
                >
                  VIEW ALL RESULTS <span>↗</span>
                </button>
              </div>
            )}
          </search>
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
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button className="wallet-button" type="button">
              <WalletCards size={14} />$18,600
            </button>
          </div>

          <Link
            className="header-profile-link"
            href="/profile"
            aria-label={session ? 'Open your profile' : 'Sign in to your profile'}
          >
            <ProfileAvatar
              initials={session?.user.email?.slice(0, 2).toUpperCase() ?? 'BT'}
              className="header-avatar"
            />
          </Link>
        </div>
      </header>

      <div className="ticker" aria-label="Live market tape">
        <div
          className="ticker-track"
          ref={tickerTrackRef}
          style={marqueeDuration ? { animationDuration: marqueeDuration } : undefined}
        >
          {[...tickerLoop, ...tickerLoop].map((item, index) => (
            <span key={`${item}-${index}`} className="ticker-item">
              <span className="ticker-bullet">◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="dashboard-wrap market-status-wrap">
        <MarketStatusStrip />
      </div>
      <div className="dashboard-wrap market-live-feed-wrap">
        <LiveMarketFeed />
      </div>
    </div>
  );
}
