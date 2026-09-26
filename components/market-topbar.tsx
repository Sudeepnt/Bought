'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from 'react';
import {
  ArrowDownToLine,
  Bell,
  Bookmark,
  CircleUser,
  LayoutGrid,
  MessageCircle,
  Moon,
  Newspaper,
  Podium,
  Check,
  Sun,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from '@/components/site-link';

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
  | 'chat'
  | 'broadcast'
  | 'review'
  | 'profile'
  | 'terms';

const navigation: Array<{ key: MarketPage; label: string; href: string }> = [
  { key: 'floor', label: 'TODAY', href: '/' },
  { key: 'categories', label: 'CATEGORIES', href: '/categories' },
  { key: 'magazine', label: 'MAGAZINE', href: '/magazine' },
  { key: 'chat', label: 'MESSAGES', href: '/chat' },
  { key: 'watchlist', label: 'WATCHLIST', href: '/watchlist' },
  { key: 'rules', label: 'HOW IT WORKS', href: '/how-it-works' },
  { key: 'profile', label: 'PROFILE', href: '/profile' },
];

const mobileNavigation: Array<{
  key: MarketPage;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { key: 'floor', label: 'Today', href: '/', icon: Podium },
  {
    key: 'categories',
    label: 'Categories',
    href: '/categories',
    icon: LayoutGrid,
  },
  { key: 'magazine', label: 'Magazine', href: '/magazine', icon: Newspaper },
  { key: 'watchlist', label: 'Watchlist', href: '/watchlist', icon: Bookmark },
  { key: 'profile', label: 'Profile', href: '/profile', icon: CircleUser },
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

function notificationAge(value: string) {
  const createdAt = Date.parse(value);
  if (!Number.isFinite(createdAt)) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
    notifications,
    unreadNotificationCount,
    browserPermission,
    browserAlertsEnabled,
    devicePushState,
    devicePushError,
    requestBrowserNotifications,
    setBrowserAlertsEnabled,
    requestDevicePushNotifications,
    disableDevicePushNotifications,
    sendDevicePushTest,
    markNotificationRead,
    markAllNotificationsRead,
  } = useBought();
  const chromeRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const marqueeDuration = useMarqueeDuration(tickerTrackRef);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [floatingCountdownVisible, setFloatingCountdownVisible] =
    useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [devicePushBusy, setDevicePushBusy] = useState(false);
  const [signInStart, setSignInStart] = useState<
    'sign-in' | 'goals' | 'categories'
  >('sign-in');
  const closeAddFunds = useCallback(() => setAddFundsOpen(false), []);
  const closeSignIn = useCallback(() => {
    setSignInOpen(false);
    setSignInStart('sign-in');
  }, []);
  const runDevicePushAction = useCallback(
    async (action: () => Promise<void>) => {
      setDevicePushBusy(true);
      try {
        await action();
      } catch {
        // The provider keeps the server or permission error beside this control.
      } finally {
        setDevicePushBusy(false);
      }
    },
    [],
  );
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
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !notificationMenuRef.current?.contains(event.target)
      )
        setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

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
              <div
                className="market-notification-menu"
                ref={notificationMenuRef}
              >
                <button
                  className={`topbar-icon-button notification-trigger ${notificationsOpen ? 'is-active' : ''}`}
                  type="button"
                  aria-label={`View notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                  aria-expanded={notificationsOpen}
                  aria-controls="market-notifications-panel"
                  onClick={() => setNotificationsOpen((open) => !open)}
                >
                  <Bell size={15} strokeWidth={1.8} />
                  {unreadNotificationCount > 0 && (
                    <span
                      className="notification-unread-badge"
                      aria-hidden="true"
                    >
                      {unreadNotificationCount > 9
                        ? '9+'
                        : unreadNotificationCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <section
                    className="market-notifications-panel"
                    id="market-notifications-panel"
                    aria-label="Notifications"
                  >
                    <header className="market-notifications-heading">
                      <div>
                        <span className="notification-kicker">
                          MARKET ALERTS
                        </span>
                        <h2>Notifications</h2>
                      </div>
                      {unreadNotificationCount > 0 && (
                        <button
                          className="notification-mark-read"
                          type="button"
                          onClick={markAllNotificationsRead}
                        >
                          <Check size={12} aria-hidden="true" />
                          Mark all read
                        </button>
                      )}
                    </header>
                    <div className="browser-alert-setting">
                      <span className="browser-alert-copy">
                        <strong>Browser notifications</strong>
                        <small>
                          {browserPermission === 'unsupported'
                            ? 'This browser does not support alerts.'
                            : browserPermission === 'denied'
                              ? 'Allow notifications in your browser settings.'
                              : browserAlertsEnabled
                                ? 'Alerts show while this BOUGHT tab is open.'
                                : 'Get outbid and #1 alerts while this tab is open.'}
                        </small>
                      </span>
                      {browserPermission === 'granted' ? (
                        <button
                          className={`browser-alert-toggle ${browserAlertsEnabled ? 'is-enabled' : ''}`}
                          type="button"
                          aria-pressed={browserAlertsEnabled}
                          onClick={() =>
                            setBrowserAlertsEnabled(!browserAlertsEnabled)
                          }
                        >
                          {browserAlertsEnabled ? 'On' : 'Off'}
                        </button>
                      ) : (
                        <button
                          className="browser-alert-enable"
                          type="button"
                          disabled={
                            browserPermission === 'unsupported' ||
                            browserPermission === 'denied'
                          }
                          onClick={() => void requestBrowserNotifications()}
                        >
                          Enable
                        </button>
                      )}
                    </div>
                    <div className="browser-alert-setting device-push-setting">
                      <span className="browser-alert-copy">
                        <strong>Phone push notifications</strong>
                        <small>
                          {devicePushError ??
                            (devicePushState === 'loading'
                              ? 'Checking push setup on this device…'
                              : devicePushState === 'enabled'
                                ? 'On — market alerts can arrive while BOUGHT is closed.'
                                : devicePushState === 'not-installed'
                                  ? 'On iPhone, add BOUGHT to your Home Screen and open it there.'
                                  : devicePushState === 'unsupported'
                                    ? 'This device does not support push notifications.'
                                    : devicePushState === 'unconfigured'
                                      ? 'Waiting for BOUGHT server push setup.'
                                      : devicePushState === 'signed-out'
                                        ? 'Sign in to connect this device to your account.'
                                        : 'Get outbid and #1 alerts even when BOUGHT is closed.')}
                        </small>
                      </span>
                      <span className="device-push-actions">
                        {devicePushState === 'enabled' ? (
                          <>
                            <button
                              className="browser-alert-toggle"
                              type="button"
                              disabled={devicePushBusy}
                              onClick={() =>
                                void runDevicePushAction(sendDevicePushTest)
                              }
                            >
                              {devicePushBusy ? '…' : 'Test'}
                            </button>
                            <button
                              className="browser-alert-toggle"
                              type="button"
                              disabled={devicePushBusy}
                              onClick={() =>
                                void runDevicePushAction(
                                  disableDevicePushNotifications,
                                )
                              }
                            >
                              Off
                            </button>
                          </>
                        ) : devicePushState === 'signed-out' ? (
                          <button
                            className="browser-alert-enable"
                            type="button"
                            onClick={() => setSignInOpen(true)}
                          >
                            Sign in
                          </button>
                        ) : (
                          <button
                            className="browser-alert-enable"
                            type="button"
                            disabled={
                              devicePushBusy || devicePushState !== 'ready'
                            }
                            onClick={() =>
                              void runDevicePushAction(
                                requestDevicePushNotifications,
                              )
                            }
                          >
                            {devicePushBusy ? '…' : 'Enable'}
                          </button>
                        )}
                      </span>
                    </div>
                    <div
                      className="market-notification-list"
                      aria-live="polite"
                    >
                      {notifications.length ? (
                        notifications.slice(0, 12).map((notification) => (
                          <Link
                            className={`market-notification-item ${notification.readAt ? '' : 'is-unread'}`}
                            href={notification.href}
                            key={notification.id}
                            onClick={() => {
                              markNotificationRead(notification.id);
                              setNotificationsOpen(false);
                            }}
                          >
                            <span
                              className={`market-notification-icon is-${notification.type}`}
                              aria-hidden="true"
                            >
                              {notification.type === 'outbid' ? '↗' : '♛'}
                            </span>
                            <span className="market-notification-copy">
                              <strong>{notification.title}</strong>
                              <span>{notification.body}</span>
                              <small>
                                {notificationAge(notification.createdAt)}
                              </small>
                            </span>
                            {!notification.readAt && (
                              <i
                                className="notification-unread-dot"
                                aria-label="Unread"
                              />
                            )}
                          </Link>
                        ))
                      ) : (
                        <p className="market-notifications-empty">
                          You&apos;re all caught up. We&apos;ll let you know
                          when the ladder moves.
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>
              <Link
                className={`topbar-icon-button topbar-message-link ${active === 'chat' ? 'is-active' : ''}`}
                href="/chat"
                aria-label="Open messages"
                aria-current={active === 'chat' ? 'page' : undefined}
              >
                <MessageCircle size={15} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </div>
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
      <nav className="mobile-bottom-navigation" aria-label="Mobile navigation">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              className={`mobile-bottom-navigation-link ${isActive ? 'is-active' : ''}`}
              data-nav-key={item.key}
              href={item.href}
              key={item.key}
              aria-current={isActive ? 'page' : undefined}
              onClick={item.key === 'profile' ? openProfile : undefined}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
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
