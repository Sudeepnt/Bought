'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from 'react';
import { ArrowDownToLine, Bell, Moon, Sun, WalletCards } from 'lucide-react';
import Link from '@/components/site-link';

import { ProfileAvatar } from '@/components/profile-avatar';
import { BrandLogo } from '@/components/brand-logo';
import { AddFundsModal } from '@/components/add-funds-modal';
import { SignInModal } from '@/components/sign-in-modal';
import { useBought } from './bought-provider';
import {
  DEV_TEST_AUTH_STORAGE_KEY,
  DEV_TEST_USER_ID,
  isDevAuthTestMode,
} from '@/lib/dev-auth';
import {
  fallbackFeedItems,
  FloatingMarketCountdown,
  LiveMarketFeed,
  MarketStatusStrip,
  useMarqueeDuration,
} from './market-chrome';
import { money } from '@/lib/drop-domain';
import {
  hasDismissedProfilePreferences,
  PROFILE_PREFERENCES_DISMISSED_METADATA_KEY,
  rememberDismissedProfilePreferences,
} from '@/lib/profile-preferences';

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
  const {
    client,
    market,
    serverTime,
    marketFresh,
    entries,
    session,
    authReady,
  } = useBought();
  const chromeRef = useRef<HTMLDivElement>(null);
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const marqueeDuration = useMarqueeDuration(tickerTrackRef);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [floatingCountdownVisible, setFloatingCountdownVisible] =
    useState(false);
  const [signInStart, setSignInStart] = useState<
    'sign-in' | 'goals' | 'categories'
  >('sign-in');
  const closeAddFunds = useCallback(() => setAddFundsOpen(false), []);
  const closeSignIn = useCallback(() => {
    setSignInOpen(false);
    setSignInStart('sign-in');
  }, []);
  const dismissProfilePreferences = useCallback(() => {
    const devTestSignedIn =
      isDevAuthTestMode() &&
      window.localStorage.getItem(DEV_TEST_AUTH_STORAGE_KEY) === '1';
    const rememberForSession = (currentSession: typeof session) => {
      if (!currentSession) return;
      rememberDismissedProfilePreferences(currentSession.user.id);
      if (client) {
        void client.auth
          .updateUser({
            data: { [PROFILE_PREFERENCES_DISMISSED_METADATA_KEY]: true },
          })
          .catch(() => undefined);
      }
    };

    if (session) {
      rememberForSession(session);
      return;
    }
    if (devTestSignedIn) {
      rememberDismissedProfilePreferences(DEV_TEST_USER_ID);
      return;
    }
    if (client) {
      void client.auth
        .getSession()
        .then(({ data }) => rememberForSession(data.session))
        .catch(() => undefined);
    }
  }, [client, session]);
  const continueToProfile = useCallback(() => {
    setSignInOpen(false);
    setSignInStart('sign-in');
    window.location.assign('/profile');
  }, []);
  // React uses the server snapshot during hydration, then applies the saved
  // preference from localStorage once the client is mounted.
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getStoredTheme,
    getServerTheme,
  );
  const isLive = marketFresh && market?.phase === 'bidding';
  const liveActivity = entries.length
    ? entries
        .slice(0, 8)
        .map(
          (entry) =>
            `LIVE ACTIVITY / ${entry.title} took #${entry.position} in ${entry.category} ${money(entry.amount_minor)}`,
        )
    : fallbackFeedItems
        .slice(0, 5)
        .map(
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
    let frame: number | null = null;

    const updateFloatingCountdown = () => {
      frame = null;
      const countdown = chromeRef.current?.querySelector('.status-countdown');
      const stickyHeader = chromeRef.current?.querySelector(
        '.market-sticky-header',
      );
      const revealBoundary = stickyHeader?.getBoundingClientRect().bottom ?? 0;
      const shouldShow = Boolean(
        countdown &&
        window.scrollY > 0 &&
        countdown.getBoundingClientRect().bottom <= revealBoundary,
      );
      setFloatingCountdownVisible((current) =>
        current === shouldShow ? current : shouldShow,
      );
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateFloatingCountdown);
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!authReady || !session) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') !== 'google') return;
    const timer = window.setTimeout(() => {
      if (!hasDismissedProfilePreferences(session)) {
        setSignInStart('goals');
        setSignInOpen(true);
      }
      params.delete('auth');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authReady, session]);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('bought-theme', nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  function openDeposit() {
    if (session) {
      setAddFundsOpen(true);
      return;
    }
    setSignInStart('sign-in');
    setSignInOpen(true);
  }

  function openProfile(event: SyntheticEvent<HTMLAnchorElement>) {
    if (session) return;
    event.preventDefault();
    setSignInStart('sign-in');
    setSignInOpen(true);
  }

  return (
    <div className="market-chrome" ref={chromeRef}>
      <div className="market-sticky-header">
        <header className="topbar topbar-centered-navigation">
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
              <div className="topbar-wallet">
                <button
                  className="topbar-wallet-trigger"
                  type="button"
                  aria-haspopup="dialog"
                  aria-controls="wallet-balance-menu"
                  aria-label="Open wallet balance"
                >
                  <WalletCards size={16} strokeWidth={1.8} aria-hidden="true" />
                  <strong>$0.00</strong>
                </button>
                <dialog
                  open
                  className="wallet-balance-menu"
                  id="wallet-balance-menu"
                  aria-label="Wallet balance"
                >
                  <div className="wallet-menu-heading">
                    <span>WALLET</span>
                    <strong>$0.00</strong>
                  </div>
                  <dl className="wallet-menu-details">
                    <div>
                      <dt>Portfolio</dt>
                      <dd>$0.00</dd>
                    </div>
                    <div>
                      <dt>Available</dt>
                      <dd>$0.00</dd>
                    </div>
                    <div>
                      <dt>Deposited</dt>
                      <dd>$0.00</dd>
                    </div>
                  </dl>
                </dialog>
              </div>
              <button
                className="deposit-button"
                type="button"
                onClick={openDeposit}
                aria-haspopup="dialog"
                aria-expanded={addFundsOpen}
              >
                <ArrowDownToLine size={15} strokeWidth={2} />
                <span>Deposit</span>
              </button>
              <button
                className="topbar-icon-button"
                type="button"
                aria-label="View notifications"
              >
                <Bell size={15} strokeWidth={1.8} />
              </button>
            </div>

            <Link
              className="header-profile-link"
              href="/profile"
              aria-label={
                session ? 'Open your profile' : 'Sign in to your profile'
              }
              onClick={openProfile}
            >
              <ProfileAvatar
                initials={
                  session?.user.email?.slice(0, 2).toUpperCase() ?? 'BT'
                }
                className="header-avatar"
              />
            </Link>
          </div>
        </header>

        <div className="ticker" aria-label="Live market tape">
          <div
            className="ticker-track"
            ref={tickerTrackRef}
            style={
              marqueeDuration
                ? { animationDuration: marqueeDuration }
                : undefined
            }
          >
            {[...tickerLoop, ...tickerLoop].map((item, index) => (
              <span key={`${item}-${index}`} className="ticker-item">
                <span className="ticker-bullet">◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="dashboard-wrap market-status-wrap">
        <MarketStatusStrip />
      </div>
      <div className="dashboard-wrap market-live-feed-wrap">
        <LiveMarketFeed />
      </div>
      <FloatingMarketCountdown visible={floatingCountdownVisible} />
      {addFundsOpen && <AddFundsModal onClose={closeAddFunds} />}
      {signInOpen && (
        <SignInModal
          onClose={closeSignIn}
          onPreferenceDismissed={dismissProfilePreferences}
          onComplete={continueToProfile}
          startAt={signInStart}
        />
      )}
    </div>
  );
}
