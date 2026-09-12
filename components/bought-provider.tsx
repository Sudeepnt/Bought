'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Market, PublishedEntry } from '@/lib/drop-domain';

type Config = {
  supabaseUrl: string | null;
  supabaseKey: string | null;
  providers: { stripe: boolean; razorpay: boolean };
};
type BoughtContext = {
  config: Config | null;
  client: SupabaseClient | null;
  session: Session | null;
  authReady: boolean;
  market: Market | null;
  serverTime: number | null;
  marketFresh: boolean;
  entries: PublishedEntry[];
  api: <T>(path: string, body?: unknown) => Promise<T>;
};
const Context = createContext<BoughtContext | null>(null);

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
  const anchor = useRef({ server: 0, monotonic: 0 });

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
    const sync = async () => {
      try {
        const response = await fetch('/api/bought/market', {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Market unavailable');
        const next: Market = await response.json();
        if (!active) return;
        anchor.current = {
          server: Date.parse(next.serverNow),
          monotonic: performance.now(),
        };
        setMarket(next);
        setServerTime(anchor.current.server);
        setMarketFresh(true);
      } catch {
        if (active) setMarketFresh(false);
      }
    };
    void sync();
    const poll = window.setInterval(sync, 15000);
    const tick = window.setInterval(() => {
      if (!anchor.current.server) return;
      const elapsed = performance.now() - anchor.current.monotonic;
      setServerTime(anchor.current.server + elapsed);
      if (elapsed > 60000) setMarketFresh(false);
    }, 1000);
    window.addEventListener('focus', sync);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const response = await fetch('/api/bought/published', {
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Published broadcasts unavailable');
        const result = (await response.json()) as {
          entries: PublishedEntry[];
        };
        if (active) setEntries(result.entries);
      } catch {
        if (active) setEntries([]);
      }
    };
    void sync();
    const poll = window.setInterval(sync, 15000);
    const channel = client
      ?.channel('published-broadcasts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bought_ladder' },
        () => void sync(),
      )
      .subscribe();
    return () => {
      active = false;
      clearInterval(poll);
      if (channel) void client?.removeChannel(channel);
    };
  }, [client]);

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
