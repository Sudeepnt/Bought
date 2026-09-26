'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Market, PublishedEntry } from '@/lib/drop-domain';
import {
  browserNotificationPreferenceKey,
  marketNotificationEvents,
  notificationStorageKey,
  readStoredNotifications,
  type MarketNotification,
  type MarketNotificationSnapshot,
} from '@/lib/market-notifications';
import {
  createDevTestSession,
  DEV_TEST_AUTH_STORAGE_KEY,
  isDevAuthTestMode,
} from '@/lib/dev-auth';

type Config = {
  supabaseUrl: string | null;
  supabaseKey: string | null;
  providers: { stripe: boolean; razorpay: boolean };
};
type BrowserPermission = NotificationPermission | 'unsupported';
type DevicePushState =
  | 'loading'
  | 'ready'
  | 'enabled'
  | 'signed-out'
  | 'not-installed'
  | 'unsupported'
  | 'unconfigured';
type BoughtContext = {
  config: Config | null;
  client: SupabaseClient | null;
  session: Session | null;
  authReady: boolean;
  market: Market | null;
  serverTime: number | null;
  marketFresh: boolean;
  entries: PublishedEntry[];
  notifications: MarketNotification[];
  unreadNotificationCount: number;
  browserPermission: BrowserPermission;
  browserAlertsEnabled: boolean;
  devicePushState: DevicePushState;
  devicePushError: string | null;
  requestBrowserNotifications: () => Promise<BrowserPermission>;
  setBrowserAlertsEnabled: (enabled: boolean) => void;
  requestDevicePushNotifications: () => Promise<void>;
  disableDevicePushNotifications: () => Promise<void>;
  sendDevicePushTest: () => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  api: <T>(path: string, body?: unknown) => Promise<T>;
};
const Context = createContext<BoughtContext | null>(null);
const browserPermissionChangeEvent = 'bought-browser-permission-change';

function getBrowserPermission(): BrowserPermission {
  return 'Notification' in window
    ? window.Notification.permission
    : 'unsupported';
}

function getServerBrowserPermission(): BrowserPermission {
  return 'default';
}

function decodeApplicationServerKey(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const decoded = window.atob(
    base64 + '='.repeat((4 - (base64.length % 4)) % 4),
  );
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isInstalledWebApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function subscribeToBrowserPermission(onChange: () => void) {
  window.addEventListener('focus', onChange);
  window.addEventListener(browserPermissionChangeEvent, onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener(browserPermissionChangeEvent, onChange);
  };
}

async function fetchJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1)
        await new Promise((resolve) =>
          window.setTimeout(resolve, 300 * 2 ** attempt),
        );
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export function BoughtProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [serverTime, setServerTime] = useState<number | null>(null);
  const [marketFresh, setMarketFresh] = useState(false);
  const [entries, setEntries] = useState<PublishedEntry[]>([]);
  const [ownedDropIds, setOwnedDropIds] = useState<string[]>([]);
  const [notificationState, setNotificationState] = useState({
    accountId: 'anonymous',
    notifications: [] as MarketNotification[],
  });
  const browserPermission = useSyncExternalStore(
    subscribeToBrowserPermission,
    getBrowserPermission,
    getServerBrowserPermission,
  );
  const [browserAlertsEnabled, setBrowserAlertsEnabledState] = useState(false);
  const [devicePushState, setDevicePushState] =
    useState<DevicePushState>('loading');
  const [devicePushError, setDevicePushError] = useState<string | null>(null);
  const [devicePushPublicKey, setDevicePushPublicKey] = useState<string | null>(
    null,
  );
  const anchor = useRef({ server: 0, monotonic: 0 });
  const publicRequest = useRef(0);
  const notificationSnapshot = useRef<{
    accountId: string;
    snapshot: MarketNotificationSnapshot;
  } | null>(null);
  const notificationsRef = useRef<MarketNotification[]>([]);
  const notificationAccountId = session?.user.id ?? 'anonymous';
  const ownedDropAccountRef = useRef<string | null>(null);

  const api = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const { data } = client
        ? await client.auth.getSession()
        : { data: { session: null } };
      const response = await fetch(`/api/bought/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          ...(data.session
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30000),
      });
      const result = (await response.json().catch(() => null)) as
        | (T & { error?: string })
        | null;
      if (!response.ok)
        throw new Error(
          result?.error ?? 'The server could not complete this request.',
        );
      if (!result) throw new Error('The server returned an invalid response.');
      return result as T;
    },
    [client],
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void fetchJsonWithRetry<Config>('/api/bought/config')
      .then(async (next) => {
        if (!active) return;
        setConfig(next);
        if (next.supabaseUrl && next.supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          if (!active) return;
          const supabase = createClient(next.supabaseUrl, next.supabaseKey);
          setClient(supabase);
          const subscription = supabase.auth.onAuthStateChange(
            (_event, current) => {
              if (active) {
                setSession(current);
                setAuthReady(true);
              }
            },
          );
          unsubscribe = () => {
            subscription.data.subscription.unsubscribe();
            void supabase.removeAllChannels();
          };
          const { data } = await supabase.auth.getSession();
          if (active) setSession(data.session);
        } else if (
          isDevAuthTestMode() &&
          window.localStorage.getItem(DEV_TEST_AUTH_STORAGE_KEY) === '1'
        ) {
          setSession(createDevTestSession());
        }
      })
      .catch(() => {
        if (active)
          setConfig({
            supabaseUrl: null,
            supabaseKey: null,
            providers: { stripe: false, razorpay: false },
          });
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadDevicePush = async () => {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setDevicePushState('unsupported');
        return;
      }
      if (isIosDevice() && !isInstalledWebApp()) {
        setDevicePushState('not-installed');
        return;
      }
      try {
        const response = await fetch('/api/bought/push/key', {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Push setup is unavailable.');
        const result = (await response.json()) as {
          publicKey: string | null;
        };
        if (!active) return;
        if (!result.publicKey) {
          setDevicePushState('unconfigured');
          return;
        }
        setDevicePushPublicKey(result.publicKey);
        if (!session) {
          setDevicePushState('signed-out');
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setDevicePushState(subscription ? 'enabled' : 'ready');
      } catch {
        if (active) setDevicePushState('unconfigured');
      }
    };
    void loadDevicePush();
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;
    let stored: MarketNotification[] = [];
    let browserAlerts = false;
    try {
      stored = readStoredNotifications(
        window.localStorage.getItem(
          notificationStorageKey(notificationAccountId),
        ),
      );
      browserAlerts =
        window.localStorage.getItem(
          browserNotificationPreferenceKey(notificationAccountId),
        ) === '1';
    } catch {
      // Storage can be disabled by privacy settings; keep an in-memory inbox.
    }
    const saved = stored;
    notificationsRef.current = saved;
    queueMicrotask(() => {
      if (!active) return;
      setNotificationState({
        accountId: notificationAccountId,
        notifications: saved,
      });
      setBrowserAlertsEnabledState(browserAlerts);
    });
    notificationSnapshot.current = null;

    const syncStoredState = (event: StorageEvent) => {
      if (event.key === notificationStorageKey(notificationAccountId)) {
        const next = readStoredNotifications(event.newValue);
        notificationsRef.current = next;
        setNotificationState({
          accountId: notificationAccountId,
          notifications: next,
        });
      }
      if (event.key === browserNotificationPreferenceKey(notificationAccountId))
        setBrowserAlertsEnabledState(event.newValue === '1');
    };
    window.addEventListener('storage', syncStoredState);
    return () => {
      active = false;
      window.removeEventListener('storage', syncStoredState);
    };
  }, [notificationAccountId]);

  useEffect(() => {
    if (!session) {
      ownedDropAccountRef.current = 'anonymous';
      return;
    }

    let active = true;
    const accountId = session.user.id;
    ownedDropAccountRef.current = null;
    const loadOwnedDrops = async () => {
      try {
        const result = await api<{
          drops: Array<{
            id: string;
            auction_id: string | null;
            state: string;
            payment_state: string;
          }>;
        }>('drops');
        if (!active) return;
        ownedDropAccountRef.current = accountId;
        setOwnedDropIds(
          result.drops
            .filter(
              (drop) =>
                drop.state === 'published' &&
                drop.payment_state === 'paid' &&
                drop.auction_id === market?.auctionId,
            )
            .map((drop) => drop.id),
        );
      } catch {
        // A temporary owner-list failure should not disrupt the public market.
      }
    };
    const loadWhenVisible = () => {
      if (!document.hidden && navigator.onLine) void loadOwnedDrops();
    };

    void loadOwnedDrops();
    const poll = window.setInterval(loadWhenVisible, 30000);
    window.addEventListener('focus', loadWhenVisible);
    window.addEventListener('online', loadWhenVisible);
    document.addEventListener('visibilitychange', loadWhenVisible);
    return () => {
      active = false;
      clearInterval(poll);
      window.removeEventListener('focus', loadWhenVisible);
      window.removeEventListener('online', loadWhenVisible);
      document.removeEventListener('visibilitychange', loadWhenVisible);
    };
  }, [api, market?.auctionId, session]);

  const syncPublic = useCallback(async () => {
    const requestId = ++publicRequest.current;
    try {
      const response = await fetch('/api/bought/snapshot', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Market unavailable');
      const next = (await response.json()) as {
        market: Market;
        entries: PublishedEntry[];
      };
      if (
        !next.market ||
        !Array.isArray(next.entries) ||
        !Number.isFinite(Date.parse(next.market.serverNow))
      )
        throw new Error('Market response is invalid');
      if (requestId !== publicRequest.current) return;
      anchor.current = {
        server: Date.parse(next.market.serverNow),
        monotonic: performance.now(),
      };
      setMarket(next.market);
      setEntries(next.entries);
      setServerTime(anchor.current.server);
      setMarketFresh(true);
    } catch (error) {
      // A slower obsolete request cannot overwrite the result of a newer sync.
      if (requestId === publicRequest.current) throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        await syncPublic();
      } catch {
        if (active) setMarketFresh(false);
      }
    };
    const syncWhenVisible = () => {
      if (!document.hidden && navigator.onLine) void sync();
    };
    void sync();
    const poll = window.setInterval(syncWhenVisible, 15000);
    const tick = window.setInterval(() => {
      if (document.hidden || !anchor.current.server) return;
      const elapsed = performance.now() - anchor.current.monotonic;
      setServerTime(anchor.current.server + elapsed);
      if (elapsed > 60000) setMarketFresh(false);
    }, 1000);
    window.addEventListener('focus', syncWhenVisible);
    window.addEventListener('online', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      active = false;
      publicRequest.current += 1;
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener('focus', syncWhenVisible);
      window.removeEventListener('online', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [syncPublic]);

  useEffect(() => {
    const channel = client
      ?.channel('published-broadcasts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bought_ladder' },
        () => void syncPublic().catch(() => setMarketFresh(false)),
      )
      .subscribe();
    return () => {
      if (channel) void client?.removeChannel(channel);
    };
  }, [client, syncPublic]);

  const persistNotifications = useCallback(
    (next: MarketNotification[]) => {
      notificationsRef.current = next;
      setNotificationState({
        accountId: notificationAccountId,
        notifications: next,
      });
      try {
        window.localStorage.setItem(
          notificationStorageKey(notificationAccountId),
          JSON.stringify(next.slice(0, 50)),
        );
      } catch {
        // Notifications remain available for the current page if storage is full.
      }
    },
    [notificationAccountId],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      const readAt = new Date().toISOString();
      persistNotifications(
        notificationsRef.current.map((notification) =>
          notification.id === id && !notification.readAt
            ? { ...notification, readAt }
            : notification,
        ),
      );
    },
    [persistNotifications],
  );

  const markAllNotificationsRead = useCallback(() => {
    const readAt = new Date().toISOString();
    persistNotifications(
      notificationsRef.current.map((notification) =>
        notification.readAt ? notification : { ...notification, readAt },
      ),
    );
  }, [persistNotifications]);

  const setBrowserAlertsEnabled = useCallback(
    (enabled: boolean) => {
      setBrowserAlertsEnabledState(enabled);
      try {
        window.localStorage.setItem(
          browserNotificationPreferenceKey(notificationAccountId),
          enabled ? '1' : '0',
        );
      } catch {
        // The setting still applies to this page if storage is unavailable.
      }
    },
    [notificationAccountId],
  );

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported' as const;
    }
    try {
      const permission = await window.Notification.requestPermission();
      window.dispatchEvent(new Event(browserPermissionChangeEvent));
      if (permission === 'granted') setBrowserAlertsEnabled(true);
      return permission;
    } catch {
      return 'default' as const;
    }
  }, [setBrowserAlertsEnabled]);

  const requestDevicePushNotifications = useCallback(async () => {
    setDevicePushError(null);
    try {
      if (!session) throw new Error('Sign in to turn on phone notifications.');
      if (!devicePushPublicKey)
        throw new Error('Phone notifications are not configured on the server.');
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw new Error('This device does not support push notifications.');
      if (isIosDevice() && !isInstalledWebApp()) {
        setDevicePushState('not-installed');
        throw new Error('Add BOUGHT to your Home Screen, then open it there.');
      }

      // iOS only permits a web app to ask while responding to the user's tap.
      const permission = await window.Notification.requestPermission();
      window.dispatchEvent(new Event(browserPermissionChangeEvent));
      if (permission !== 'granted') {
        throw new Error(
          permission === 'denied'
            ? 'Notifications are blocked in device settings.'
            : 'Allow notifications to receive BOUGHT market alerts.',
        );
      }

      const registration = await navigator.serviceWorker.register(
        '/notifications-sw.js',
        { scope: '/' },
      );
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(
            devicePushPublicKey,
          ),
        }));
      try {
        await api('push/subscription', {
          subscription: subscription.toJSON(),
        });
      } catch (error) {
        if (!existing) await subscription.unsubscribe();
        throw error;
      }
      setDevicePushState('enabled');
    } catch (error) {
      setDevicePushError(
        error instanceof Error ? error.message : 'Phone alerts could not be enabled.',
      );
      throw error;
    }
  }, [api, devicePushPublicKey, session]);

  const disableDevicePushNotifications = useCallback(async () => {
    setDevicePushError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api('push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setDevicePushState(devicePushPublicKey ? 'ready' : 'unconfigured');
    } catch (error) {
      setDevicePushError(
        error instanceof Error ? error.message : 'Phone alerts could not be turned off.',
      );
      throw error;
    }
  }, [api, devicePushPublicKey]);

  const sendDevicePushTest = useCallback(async () => {
    setDevicePushError(null);
    try {
      await api('push/test', {});
    } catch (error) {
      setDevicePushError(
        error instanceof Error ? error.message : 'Test alert could not be sent.',
      );
      throw error;
    }
  }, [api]);

  useEffect(() => {
    if (!marketFresh || !market) return;
    if (session && ownedDropAccountRef.current !== session.user.id) return;
    const currentSnapshot: MarketNotificationSnapshot = {
      auctionId: market.auctionId,
      phase: market.phase,
      entries: entries.map(({ drop_id, position, category, title }) => ({
        drop_id,
        position,
        category,
        title,
      })),
    };
    const previous = notificationSnapshot.current;
    if (!previous || previous.accountId !== notificationAccountId) {
      notificationSnapshot.current = {
        accountId: notificationAccountId,
        snapshot: currentSnapshot,
      };
      return;
    }

    const events = marketNotificationEvents(
      previous.snapshot,
      currentSnapshot,
      session ? ownedDropIds : [],
    );
    notificationSnapshot.current = {
      accountId: notificationAccountId,
      snapshot: currentSnapshot,
    };
    if (events.length === 0) return;

    const createdAt = new Date().toISOString();
    const additions = events.map((event, index) => ({
      ...event,
      id: `${market.auctionId}:${Date.now()}:${index}`,
      createdAt,
      readAt: null,
    }));
    persistNotifications(
      [...additions, ...notificationsRef.current].slice(0, 50),
    );

    if (!browserAlertsEnabled || browserPermission !== 'granted') return;
    for (const notification of additions) {
      void (async () => {
        const options: NotificationOptions = {
          body: notification.body,
          icon: '/favicon.svg',
          tag: notification.id,
          data: { href: notification.href },
        };
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register(
              '/notifications-sw.js',
            );
            if (await registration.pushManager?.getSubscription()) return;
            await registration.showNotification(notification.title, options);
            return;
          }
        } catch {
          // Fall back to the page Notification API where service workers are unavailable.
        }
        const browserNotification = new window.Notification(
          notification.title,
          options,
        );
        browserNotification.onclick = () => {
          window.focus();
          window.location.assign(notification.href);
        };
      })();
    }
  }, [
    browserAlertsEnabled,
    browserPermission,
    entries,
    market,
    marketFresh,
    notificationAccountId,
    ownedDropIds,
    persistNotifications,
    session,
  ]);

  const activeNotifications =
    notificationState.accountId === notificationAccountId
      ? notificationState.notifications
      : [];

  return (
    <Context.Provider
      value={{
        config,
        client,
        session,
        authReady,
        market,
        serverTime,
        marketFresh,
        entries,
        notifications: activeNotifications,
        unreadNotificationCount: activeNotifications.filter(
          (item) => !item.readAt,
        ).length,
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
        api,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useBought() {
  const context = useContext(Context);
  if (!context) throw new Error('BoughtProvider is required.');
  return context;
}
