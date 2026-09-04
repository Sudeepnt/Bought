'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock3,
  Globe2,
  LockKeyhole,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Phase = 'live' | 'locked';

type LadderRow = {
  rank: number;
  name: string;
  handle: string;
  initials: string;
  country: string;
  countryCode: string;
  statement: string;
  price: number;
  change: number;
  watched: string;
  conviction: number;
  color: string;
  you?: boolean;
};

type Market = {
  name: string;
  code: string;
  participants: string;
  price: number;
  change: number;
  tone: string;
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: unknown) => unknown;
      annotations?: {
        readOnlyHint?: boolean;
        untrustedContentHint?: boolean;
      };
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

type ModelDocument = Document & { modelContext?: ModelContext };

const markets: Market[] = [
  {
    name: 'Unpopular Opinion',
    code: 'UO',
    participants: '24.8k',
    price: 11400,
    change: 14.2,
    tone: 'orange',
  },
  {
    name: 'Building in Public',
    code: 'BIP',
    participants: '18.2k',
    price: 9100,
    change: 8.4,
    tone: 'green',
  },
  {
    name: 'The Ask',
    code: 'ASK',
    participants: '12.9k',
    price: 8750,
    change: -3.1,
    tone: 'red',
  },
  {
    name: 'Defend Your Stack',
    code: 'DYS',
    participants: '9.4k',
    price: 6200,
    change: 5.8,
    tone: 'blue',
  },
  {
    name: 'Indian D2C',
    code: 'D2C',
    participants: '7.1k',
    price: 5400,
    change: 2.6,
    tone: 'purple',
  },
];

type Category = {
  label: string;
  short: string;
  glyph: string;
  tone: string;
  leaders: [string, string, string];
};

const categories: Category[] = [
  {
    label: 'Leaderboards & Attention Markets',
    short: 'Attention Index',
    glyph: '✣',
    tone: 'orange',
    leaders: ['Winning Room', 'Open Ladder', 'OneWord'],
  },
  {
    label: 'SEO & AI Visibility',
    short: 'Visibility Index',
    glyph: '⌕',
    tone: 'blue',
    leaders: ['Outrank', 'CrowdReply', 'ZeroRank'],
  },
  {
    label: 'Marketing & Advertising',
    short: 'Marketing Index',
    glyph: '◈',
    tone: 'coral',
    leaders: ['Tutti', 'Letter Friend', 'Affiliateo'],
  },
  {
    label: 'Productivity & Personal Tools',
    short: 'Productivity Index',
    glyph: '≡',
    tone: 'lime',
    leaders: ['Turingo', 'Tracked', 'MyThoughts'],
  },
  {
    label: 'AI Agents & Infrastructure',
    short: 'Agents Index',
    glyph: '⌘',
    tone: 'violet',
    leaders: ['see.io', 'JONI', 'Pecan AI'],
  },
  {
    label: 'Other',
    short: 'Other Index',
    glyph: '⊹',
    tone: 'stone',
    leaders: ['Divi', 'shp.ee', 'Make a Hug'],
  },
  {
    label: 'Crypto, Web3 & Investing',
    short: 'Crypto Index',
    glyph: '₿',
    tone: 'gold',
    leaders: ['Orynth', 'PumpFunCoin', 'Fiber'],
  },
  {
    label: 'Developer Tools',
    short: 'Developer Index',
    glyph: '</>',
    tone: 'sky',
    leaders: ['Modulate', 'Context.dev', 'Trylle'],
  },
  {
    label: 'Health, Fitness & Wellness',
    short: 'Health Index',
    glyph: '♡',
    tone: 'green',
    leaders: ['Fuel Log', 'My Workout Logs', 'PeptiPrices'],
  },
  {
    label: 'Business, Finance & Legal',
    short: 'Business Index',
    glyph: '⚖',
    tone: 'navy',
    leaders: ['FloPay', 'myTB.ai', 'Klover'],
  },
  {
    label: 'Games & Entertainment',
    short: 'Games Index',
    glyph: '✦',
    tone: 'pink',
    leaders: ['Colonist', 'TorrentClaw', 'Crypto Casinos'],
  },
  {
    label: 'Ecommerce & Retail',
    short: 'Commerce Index',
    glyph: '□',
    tone: 'teal',
    leaders: ['Four', 'Yoho', 'Peptide Hub'],
  },
  {
    label: 'Travel, Local & Lifestyle',
    short: 'Travel Index',
    glyph: '⌖',
    tone: 'orange',
    leaders: ['Wento', 'Overnightly', 'Service Dog Certs'],
  },
  {
    label: 'Directories, Launch & Discovery',
    short: 'Discovery Index',
    glyph: '⊞',
    tone: 'blue',
    leaders: ['indie.game', 'Tiny Startups', 'ONEWORD'],
  },
  {
    label: 'Agencies, Studios & Services',
    short: 'Services Index',
    glyph: '▱',
    tone: 'coral',
    leaders: ['AY Automate', 'Launch Club', 'Limestone Digital'],
  },
  {
    label: 'AI Media Generation',
    short: 'Media Index',
    glyph: '✺',
    tone: 'purple',
    leaders: ['VisualLift', 'Luo Solutions', 'Klodsy'],
  },
  {
    label: 'Social Media & Creator Tools',
    short: 'Social Index',
    glyph: '⌁',
    tone: 'pink',
    leaders: ['Linkie', 'Publer', 'ContentStudio'],
  },
  {
    label: 'Education & Learning',
    short: 'Learning Index',
    glyph: '△',
    tone: 'violet',
    leaders: ['Otio', 'Educate 10M', 'Unive'],
  },
  {
    label: 'People & Profiles',
    short: 'People Index',
    glyph: '◎',
    tone: 'green',
    leaders: ['RobbyFrank', 'MayThe5th', 'Adrieves'],
  },
  {
    label: 'Design & Creative',
    short: 'Design Index',
    glyph: '✎',
    tone: 'gold',
    leaders: ['NeoCam', 'Influencer AI', 'HorizonX'],
  },
  {
    label: 'Hiring, Jobs & Careers',
    short: 'Hiring Index',
    glyph: '▣',
    tone: 'blue',
    leaders: ['LATAMHire', 'Spin Hire', 'Simple CV'],
  },
  {
    label: 'Domains & Web Assets',
    short: 'Domains Index',
    glyph: '⌁',
    tone: 'orange',
    leaders: ['NameRockstar', 'NextBrand', 'Domain Registrar'],
  },
  {
    label: 'Security, Privacy & Compliance',
    short: 'Security Index',
    glyph: '◇',
    tone: 'green',
    leaders: ['Comp AI', 'Screenata', 'Veyl'],
  },
  {
    label: 'Media & News',
    short: 'News Index',
    glyph: '▤',
    tone: 'coral',
    leaders: ['Hark News', 'Coverage Desk', 'Mangii'],
  },
  {
    label: 'Sales & Lead Generation',
    short: 'Sales Index',
    glyph: '↗',
    tone: 'lime',
    leaders: ['AutoMailer', 'RAEK', 'Prospactive'],
  },
  {
    label: 'Real Estate & Property',
    short: 'Property Index',
    glyph: '⌂',
    tone: 'navy',
    leaders: ['Buy or Sell', 'FlyDragon', 'Dumpster Desk'],
  },
  {
    label: 'Writing & Content',
    short: 'Writing Index',
    glyph: '¶',
    tone: 'purple',
    leaders: ['StealthGPT', 'Capital Mischief', 'ReverseGPT'],
  },
  {
    label: 'Audio, Voice & Podcasting',
    short: 'Audio Index',
    glyph: '◖',
    tone: 'sky',
    leaders: ['Palabra.ai', 'ekto', 'Wave'],
  },
];

const ladder: LadderRow[] = [
  {
    rank: 1,
    name: 'Ananya Rao',
    handle: '@ananyabuilds',
    initials: 'AR',
    country: 'India',
    countryCode: 'IN',
    statement: 'Your design system is productivity theatre.',
    price: 11400,
    change: 18.4,
    watched: '14.2k',
    conviction: 92,
    color: 'coral',
  },
  {
    rank: 2,
    name: 'Ethan Cole',
    handle: '@ethancole',
    initials: 'EC',
    country: 'United States',
    countryCode: 'US',
    statement: 'Every AI roadmap is a budget spreadsheet.',
    price: 9100,
    change: 8.4,
    watched: '9.8k',
    conviction: 78,
    color: 'lime',
  },
  {
    rank: 3,
    name: 'Farah Khan',
    handle: '@farahmakes',
    initials: 'FK',
    country: 'United Kingdom',
    countryCode: 'GB',
    statement: "You don't need another community.",
    price: 8750,
    change: -3.1,
    watched: '7.4k',
    conviction: 71,
    color: 'sky',
  },
  {
    rank: 4,
    name: 'Lucas Meyer',
    handle: '@lucasbuilds',
    initials: 'LM',
    country: 'Germany',
    countryCode: 'DE',
    statement: 'The best product roadmap is a shorter one.',
    price: 7600,
    change: 5.8,
    watched: '6.6k',
    conviction: 64,
    color: 'violet',
  },
  {
    rank: 5,
    name: 'Sudeep K.',
    handle: '@sudeepkiccha',
    initials: 'SK',
    country: 'India',
    countryCode: 'IN',
    statement: 'Attention is the only market that never closes.',
    price: 6200,
    change: 11.6,
    watched: '5.1k',
    conviction: 59,
    color: 'orange',
    you: true,
  },
];

const countries = [
  { name: 'Mumbai', zone: 'Asia/Kolkata', code: 'IN' },
  { name: 'New York', zone: 'America/New_York', code: 'US' },
  { name: 'London', zone: 'Europe/London', code: 'GB' },
  { name: 'Singapore', zone: 'Asia/Singapore', code: 'SG' },
  { name: 'Sydney', zone: 'Australia/Sydney', code: 'AU' },
  { name: 'Dubai', zone: 'Asia/Dubai', code: 'AE' },
];

const tickerItems = [
  'GLOBAL LADDER +1.8%',
  'UO / ANANYA RAO ₹11,400',
  '24.8K WATCHING THE FLOOR',
  'NEXT DROP 00:00 UTC',
  'NEW POSITION: @MARCUSK',
  'BIP / ETHAN COLE ₹9,100',
];

const formatMoney = (value: number) => `₹${value.toLocaleString('en-IN')}`;

function getPhase(date: Date): Phase {
  return date.getUTCHours() < 12 ? 'live' : 'locked';
}

function getBoundary(date: Date, phase: Phase) {
  const boundary = new Date(date);
  if (phase === 'live') {
    boundary.setUTCHours(12, 0, 0, 0);
  } else {
    boundary.setUTCDate(boundary.getUTCDate() + 1);
    boundary.setUTCHours(0, 0, 0, 0);
  }
  return boundary;
}

function getNextDrop(date: Date) {
  const drop = new Date(date);
  drop.setUTCDate(drop.getUTCDate() + 1);
  drop.setUTCHours(0, 0, 0, 0);
  return drop;
}

function formatCountdown(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function timeAt(date: Date, timeZone: string, withSeconds = false) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(date);
}

function dateAt(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .toUpperCase();
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function Home() {
  const [now, setNow] = useState(() => new Date(0));
  const [activeMarket, setActiveMarket] = useState(markets[0]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('market');
  const [selectedRow, setSelectedRow] = useState<LadderRow | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [bid, setBid] = useState('11501');
  const [wallet, setWallet] = useState(18600);
  const [position, setPosition] = useState(5);
  const [myPrice, setMyPrice] = useState(6200);
  const [notice, setNotice] = useState('');
  const marketStateRef = useRef<{
    phase: Phase;
    now: Date;
    boundary: Date;
    nextDrop: Date;
    activeMarket: Market;
    liveLadder: LadderRow[];
    wallet: number;
    position: number;
    myPrice: number;
  } | null>(null);
  const openOrderRef = useRef<(row: LadderRow) => void>(() => undefined);
  const positionActionRef = useRef<
    (next: number) => { ok: boolean; message: string }
  >(() => ({ ok: false, message: 'Unavailable' }));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = getPhase(now);
  const boundary = getBoundary(now, phase);
  const nextDrop = getNextDrop(now);
  const progress =
    phase === 'live'
      ? ((now.getUTCHours() * 3600 +
          now.getUTCMinutes() * 60 +
          now.getUTCSeconds()) /
          43200) *
        100
      : (((now.getUTCHours() - 12) * 3600 +
          now.getUTCMinutes() * 60 +
          now.getUTCSeconds()) /
          43200) *
        100;

  const liveLadder = useMemo(() => {
    if (position !== 1) return ladder;
    return [
      { ...ladder[4], rank: 1, price: myPrice },
      { ...ladder[0], rank: 2 },
      { ...ladder[1], rank: 3 },
      { ...ladder[2], rank: 4 },
      { ...ladder[3], rank: 5 },
    ];
  }, [myPrice, position]);
  const topRow = liveLadder[0];
  const chaseLadder = liveLadder.slice(1);

  const openOrder = (row: LadderRow) => {
    setSelectedRow(row);
    setBid(String(Math.max(row.price + 101, myPrice + 101)));
    setOrderOpen(true);
    setRecordOpen(false);
  };

  const executeBid = (next: number) => {
    if (!Number.isFinite(next) || next <= myPrice) {
      const message = `Enter more than ${formatMoney(myPrice)} to move up.`;
      setNotice(message);
      return { ok: false, message };
    }
    const debit = next - myPrice;
    if (debit > wallet) {
      const message = 'Your available balance cannot cover this move.';
      setNotice(message);
      return { ok: false, message };
    }
    setWallet((value) => value - debit);
    setMyPrice(next);
    setPosition(1);
    const message = `Position taken. You are now #1 at ${formatMoney(next)}.`;
    setNotice(message);
    setOrderOpen(false);
    return { ok: true, message };
  };

  const placeBid = () => {
    executeBid(Number(bid));
  };

  useEffect(() => {
    marketStateRef.current = {
      phase,
      now,
      boundary,
      nextDrop,
      activeMarket,
      liveLadder,
      wallet,
      position,
      myPrice,
    };
    openOrderRef.current = openOrder;
    positionActionRef.current = executeBid;
  });

  useEffect(() => {
    const context = (document as ModelDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        // Unsupported or rejected registrations should never affect the visible site.
      }
    };

    register({
      name: 'read_market_state',
      title: 'Read market state',
      description:
        'Read the current UTC phase, countdown, active market, top position, and the user position without changing state.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        const state = marketStateRef.current;
        if (!state) throw new Error('Market state is not ready.');
        return {
          phase: state.phase === 'live' ? 'auction_live' : 'locked_exposure',
          utc: state.now.toISOString(),
          phaseEndsAt: state.boundary.toISOString(),
          nextDropAt: state.nextDrop.toISOString(),
          market: state.activeMarket.code,
          topPosition: state.activeMarket.price,
          userPosition: state.position,
          userSpend: state.myPrice,
          availableBalance: state.wallet,
        };
      },
    });
    register({
      name: 'start_order_ticket',
      title: 'Start an order ticket',
      description:
        'Open the visible order ticket for a player handle during the live auction. This stages a position and does not place it.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description: 'Player handle such as @ananyabuilds',
          },
        },
        required: ['handle'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const state = marketStateRef.current;
        const handle =
          typeof (input as { handle?: unknown })?.handle === 'string'
            ? (input as { handle: string }).handle
            : '';
        if (!state || !handle) throw new Error('A player handle is required.');
        if (state.phase === 'locked')
          throw new Error(
            'The market is in locked exposure. Wait for the next drop.',
          );
        const row = state.liveLadder.find(
          (candidate) => candidate.handle === handle,
        );
        if (!row) throw new Error(`No player found for ${handle}.`);
        openOrderRef.current(row);
        return {
          status: 'order_ticket_open',
          market: state.activeMarket.code,
          handle: row.handle,
          currentPosition: row.price,
        };
      },
    });
    register({
      name: 'place_position',
      title: 'Place a position',
      description:
        'Place a new position on the visible global ladder during the live auction. The new position must be above the current user spend.',
      inputSchema: {
        type: 'object',
        properties: {
          newPosition: {
            type: 'integer',
            minimum: 1,
            description: 'New total spend in BOUGHT credits',
          },
        },
        required: ['newPosition'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const value = (input as { newPosition?: unknown })?.newPosition;
        if (typeof value !== 'number' || !Number.isInteger(value))
          throw new Error('newPosition must be an integer.');
        const result = positionActionRef.current(value);
        if (!result.ok) throw new Error(result.message);
        return { status: 'position_placed', newPosition: value, globalRank: 1 };
      },
    });

    return () => lifecycle.abort();
  }, []);

  const phaseLabel = phase === 'live' ? 'AUCTION LIVE' : 'LOCKED EXPOSURE';
  const phaseDescription =
    phase === 'live'
      ? 'The floor is open. Every position can move.'
      : 'The ladder is sealed. Watch the exposure settle.';

  return (
    <main className="market-shell">
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <a className="brand-mark" href="#top" aria-label="BOUGHT home">
          <span className="brand-dot" />
          <span>BOUGHT</span>
        </a>

        <div className="market-status" aria-live="polite">
          <span
            className={`status-dot ${phase === 'live' ? 'is-live' : 'is-locked'}`}
          />
          <span>{phaseLabel}</span>
          <span className="status-separator">/</span>
          <span className="muted">{dateAt(now, 'UTC')}</span>
        </div>

        <div className="topbar-actions">
          <div className="clock-readout">
            <span className="eyebrow">UTC PRIMARY CLOCK</span>
            <time>{timeAt(now, 'UTC', true)}</time>
          </div>
          <Link className="waitlist-toplink" href="/waitlist">
            JOIN WAITLIST <ArrowUpRight size={13} />
          </Link>
          <Button className="wallet-button" variant="outline" size="sm">
            <WalletCards size={14} />
            {formatMoney(wallet)}
          </Button>
          <button className="mobile-menu" aria-label="Open menu">
            <Menu size={18} />
          </button>
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

      <nav className="category-nav" aria-label="Browse global categories">
        <button
          className={`category-nav-item ${activeCategory === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          <span className="category-nav-glyph">◎</span> ALL
        </button>
        {categories.map((category) => (
          <button
            className={`category-nav-item ${activeCategory === category.label ? 'is-active' : ''}`}
            key={category.label}
            onClick={() => {
              setActiveCategory(category.label);
              setNotice(`${category.label} selected. The ladder stays global.`);
            }}
          >
            <span className={`category-nav-glyph glyph-${category.tone}`}>
              {category.glyph}
            </span>
            {category.label}
          </button>
        ))}
        <a className="category-nav-explore" href="#categories">
          EXPLORE <ChevronRight size={13} />
        </a>
      </nav>

      <div className="app-frame" id="top">
        <aside className="side-rail">
          <div className="rail-section">
            <span className="rail-label">MARKETS</span>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              orientation="vertical"
            >
              <TabsList variant="line" className="rail-tabs">
                <TabsTrigger value="market" className="rail-tab">
                  <Activity size={14} /> The floor
                </TabsTrigger>
                <TabsTrigger value="index" className="rail-tab">
                  <Trophy size={14} /> Global index
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="rail-tab">
                  <Zap size={14} /> Watchlist{' '}
                  <span className="rail-count">08</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="rail-section rail-editorial">
            <span className="rail-label">EDITORIAL</span>
            <a className="rail-link" href="#magazine">
              <BookOpen size={14} /> Magazine
            </a>
            <a className="rail-link" href="#articles">
              <Sparkles size={14} /> Field notes
            </a>
            <a className="rail-link" href="#how-it-works">
              <ShieldCheck size={14} /> How it works
            </a>
            <a className="rail-link" href="#categories">
              <Globe2 size={14} /> All categories
            </a>
          </div>
          <div className="rail-footer">
            <div className="rail-footer-line">
              <span className="status-dot is-live" /> MARKET DATA LIVE
            </div>
            <div>v0.1 / UTC-NATIVE</div>
          </div>
        </aside>

        <div className="content-column">
          <section className="market-intro">
            <div>
              <p className="kicker">
                <Radio size={13} /> GLOBAL ATTENTION EXCHANGE
              </p>
              <h1>
                Global attention.
                <br />
                <em>Exchange open.</em>
              </h1>
              <p className="intro-copy">
                LIVE GLOBAL LADDER / 184 COUNTRIES / UTC-NATIVE
                <br />
                BID TO MOVE UP. HOLD YOUR POSITION THROUGH THE CLOSE.
              </p>
            </div>
            <div className="intro-aside">
              <div className="mini-label">TODAY&apos;S DROP</div>
              <div className="drop-time">
                00:00 <span>UTC</span>
              </div>
              <p>
                12H AUCTION <span className="accent-slash">/</span> 12H LOCKED
                EXPOSURE
              </p>
            </div>
          </section>

          <section className="phase-panel panel" aria-label="Market phase">
            <div className="phase-copy">
              <div className="phase-heading">
                <span
                  className={`status-dot ${phase === 'live' ? 'is-live' : 'is-locked'}`}
                />{' '}
                {phaseLabel}
              </div>
              <p>{phaseDescription}</p>
            </div>
            <div className="phase-clock">
              <span className="eyebrow">
                {phase === 'live' ? 'CLOSES IN' : 'DROP IN'}
              </span>
              <strong>
                {formatCountdown(boundary.getTime() - now.getTime())}
              </strong>
            </div>
            <div
              className="phase-meter"
              aria-label={`${Math.round(progress)} percent through current market phase`}
            >
              <div
                className="phase-meter-fill"
                style={{ width: `${Math.max(1, Math.min(100, progress))}%` }}
              />
              <div className="phase-meter-labels">
                <span>00:00 OPEN</span>
                <span>12:00 LOCK</span>
                <span>00:00 DROP</span>
              </div>
            </div>
            <div className="phase-rule">
              <Clock3 size={14} /> Next drop{' '}
              <strong>{timeAt(nextDrop, 'UTC')}</strong> UTC
            </div>
          </section>

          <section className="market-grid">
            <div className="panel market-board" id="index">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">THE FLOOR / GLOBAL LADDER</p>
                  <h2>{activeMarket.name}</h2>
                </div>
                <Badge variant="outline" className="live-badge">
                  <span
                    className={`status-dot ${phase === 'live' ? 'is-live' : 'is-locked'}`}
                  />{' '}
                  {phaseLabel}
                </Badge>
              </div>

              <div className="market-tabs" role="tablist" aria-label="Markets">
                {markets.map((market) => (
                  <button
                    key={market.code}
                    className={`market-tab ${activeMarket.code === market.code ? 'is-active' : ''}`}
                    onClick={() => setActiveMarket(market)}
                    role="tab"
                    aria-selected={activeMarket.code === market.code}
                  >
                    <span className={`market-swatch swatch-${market.tone}`} />
                    <span>{market.code}</span>
                  </button>
                ))}
              </div>

              <div className="market-summary">
                <div>
                  <span className="eyebrow">TOP POSITION</span>
                  <strong>{formatMoney(activeMarket.price)}</strong>
                </div>
                <div>
                  <span className="eyebrow">24H CHANGE</span>
                  <Delta value={activeMarket.change} />
                </div>
                <div>
                  <span className="eyebrow">IN THE ROOM</span>
                  <strong>{activeMarket.participants}</strong>
                </div>
                <div className="sparkline" aria-label="Market trend rising">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>

              <div
                className="leader-card"
                aria-label={`Current leader: ${topRow.name} at ${formatMoney(topRow.price)}`}
              >
                <div className="leader-card-top">
                  <span className="leader-kicker">
                    <span className="status-dot is-live" /> CURRENT LEADER
                  </span>
                  <span className="leader-rank-label">
                    POSITION <strong>#01</strong>
                  </span>
                </div>
                <div className="leader-card-body">
                  <div className="leader-rank-display">#1</div>
                  <div
                    className={`avatar leader-avatar avatar-${topRow.color}`}
                  >
                    {topRow.initials}
                  </div>
                  <div className="leader-copy">
                    <div className="leader-name-line">
                      <strong>{topRow.name}</strong>{' '}
                      {topRow.you && <Badge className="you-badge">YOU</Badge>}
                    </div>
                    <div className="leader-statement">{topRow.statement}</div>
                    <div className="player-meta">
                      {topRow.handle} <span>/</span> {topRow.countryCode}
                    </div>
                  </div>
                  <div className="leader-price">
                    <span className="eyebrow">POSITION VALUE</span>
                    <strong>{formatMoney(topRow.price)}</strong>
                    <Delta value={topRow.change} />
                  </div>
                  <Button
                    className="leader-action"
                    onClick={() => openOrder(topRow)}
                    disabled={phase === 'locked' || topRow.you}
                  >
                    {topRow.you
                      ? 'YOU HOLD #1'
                      : phase === 'live'
                        ? 'TAKE THE LEAD'
                        : 'LOCKED'}{' '}
                    <ArrowUpRight size={15} />
                  </Button>
                </div>
                <div className="leader-card-footer">
                  <span>
                    <Trophy size={13} /> {topRow.watched} watching the top spot
                  </span>
                  <span>Every move is public</span>
                </div>
              </div>

              <div className="ladder-section-label">
                <span>THE CHASE</span>
                <span>POSITIONS 02—05 / KEEP CLIMBING</span>
              </div>

              <div
                className="ladder-table"
                aria-label={`${activeMarket.name} global ladder`}
              >
                <div className="ladder-head">
                  <span>POS</span>
                  <span>PLAYER / STATEMENT</span>
                  <span>POSITION</span>
                  <span>MOVE</span>
                  <span>ROOM</span>
                  <span />
                </div>
                {chaseLadder.map((row) => (
                  <div
                    className={`ladder-row ${row.you ? 'is-you' : ''}`}
                    key={`${row.handle}-${row.rank}`}
                  >
                    <span className="rank-number">
                      {String(row.rank).padStart(2, '0')}
                    </span>
                    <div className="player-cell">
                      <div className={`avatar avatar-${row.color}`}>
                        {row.initials}
                      </div>
                      <div>
                        <div className="player-name">
                          {row.name}{' '}
                          {row.you && <Badge className="you-badge">YOU</Badge>}
                        </div>
                        <div className="player-statement">{row.statement}</div>
                        <div className="player-meta">
                          {row.handle} <span>/</span> {row.countryCode}
                        </div>
                      </div>
                    </div>
                    <span className="position-value">
                      {formatMoney(row.price)}
                    </span>
                    <Delta value={row.change} />
                    <div className="room-cell">
                      <span>{row.watched}</span>
                      <div className="conviction-bar">
                        <span style={{ width: `${row.conviction}%` }} />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="row-action"
                      onClick={() => openOrder(row)}
                      aria-label={`Take position against ${row.name}`}
                      disabled={phase === 'locked'}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="ladder-footer">
                <span>
                  <Globe2 size={14} /> 1 ladder / 184 countries
                </span>
                <button
                  onClick={() =>
                    setNotice(
                      'The global index is built from every active market, not split by region.',
                    )
                  }
                >
                  VIEW METHODOLOGY <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <aside className="right-rail">
              <section className="panel order-panel">
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">YOUR POSITION</p>
                    <h3>
                      {position === 1 ? 'You moved up.' : 'Get on the board.'}
                    </h3>
                  </div>
                  <span className="position-badge">
                    #{String(position).padStart(2, '0')}
                  </span>
                </div>
                <div className="position-visual">
                  <div className="position-circle">
                    <strong>{formatMoney(myPrice)}</strong>
                    <span>YOUR SPEND</span>
                  </div>
                  <div className="position-copy">
                    <div className="delta delta-up">
                      <ArrowUpRight size={13} /> +11.6%
                    </div>
                    <p>vs last drop</p>
                  </div>
                </div>
                <div className="position-stats">
                  <div>
                    <span>GLOBAL RANK</span>
                    <strong>
                      #{String(position).padStart(2, '0')} / 24.8k
                    </strong>
                  </div>
                  <div>
                    <span>AVAILABLE</span>
                    <strong>{formatMoney(wallet)}</strong>
                  </div>
                </div>
                <Button
                  className="primary-action"
                  onClick={() => openOrder(topRow)}
                  disabled={phase === 'locked' || topRow.you}
                >
                  {topRow.you
                    ? 'YOU HOLD #1'
                    : phase === 'live'
                      ? 'TAKE THE LEAD'
                      : 'WATCH THE CLOSE'}{' '}
                  <ArrowUpRight size={15} />
                </Button>
                <Button
                  variant="outline"
                  className="secondary-action"
                  onClick={() => {
                    setRecordOpen(true);
                    setOrderOpen(false);
                  }}
                >
                  <Radio size={14} /> RECORD YOUR TAKE
                </Button>
              </section>

              <section className="panel world-panel">
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">THE WORLD IS OPEN</p>
                    <h3>One room, many clocks.</h3>
                  </div>
                  <Globe2 size={17} className="muted-icon" />
                </div>
                <div className="country-list">
                  {countries.map((country) => (
                    <div
                      className="country-row"
                      key={country.code + country.name}
                    >
                      <span className="country-code">{country.code}</span>
                      <span>{country.name}</span>
                      <time>{timeAt(now, country.zone)}</time>
                      <span
                        className={`phase-mini ${phase === 'live' ? 'is-live' : ''}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="utc-note">
                  <Clock3 size={13} /> Every market event resolves in UTC.
                </div>
              </section>
            </aside>
          </section>

          <section className="category-directory panel" id="categories">
            <div className="directory-header">
              <div>
                <p className="kicker">
                  <Globe2 size={13} /> GLOBAL CATEGORY INDEX
                </p>
                <h2>All categories.</h2>
                <p>Every category has its own view. The ladder stays shared.</p>
              </div>
              <div className="directory-stat">
                <strong>28</strong>
                <span>
                  CATEGORIES
                  <br />
                  ONE ROOM
                </span>
              </div>
            </div>

            <div className="active-category-line">
              <span>
                <span className="status-dot is-live" /> BROWSE THE INDEX
              </span>
              <strong>
                {activeCategory === 'all'
                  ? 'ALL MARKETS'
                  : activeCategory.toUpperCase()}
              </strong>
              <span className="active-category-hint">
                Select a category to pin it.
              </span>
            </div>

            <div className="hot-directory">
              <div className="directory-subheading">
                <span className="hot-pip" /> MOST ACTIVE CATEGORIES{' '}
                <span>where attention is moving now</span>
              </div>
              <div className="hot-directory-grid">
                {categories.slice(2, 5).map((category, index) => (
                  <button
                    className="hot-category-card"
                    key={category.label}
                    onClick={() => {
                      setActiveCategory(category.label);
                      setNotice(
                        `${category.label} selected. The ladder stays global.`,
                      );
                    }}
                  >
                    <div className="hot-card-top">
                      <span className={`category-glyph glyph-${category.tone}`}>
                        {category.glyph}
                      </span>
                      <span>#{String(index + 1).padStart(2, '0')} ACTIVE</span>
                    </div>
                    <strong>{category.label}</strong>
                    <div className="hot-card-bottom">
                      <span>{5 - index} CLAIMS</span>
                      <span>
                        {index === 0 ? '08 MIN' : `${index + 2}H AGO`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="category-card-grid">
              {categories.map((category, categoryIndex) => (
                <button
                  className={`category-card ${activeCategory === category.label ? 'is-selected' : ''}`}
                  key={category.label}
                  onClick={() => {
                    setActiveCategory(category.label);
                    setNotice(
                      `${category.label} selected. The ladder stays global.`,
                    );
                  }}
                >
                  <div className="category-card-heading">
                    <span className={`category-glyph glyph-${category.tone}`}>
                      {category.glyph}
                    </span>
                    <strong>{category.label}</strong>
                    <ChevronRight size={15} />
                  </div>
                  <div className="category-leader-list">
                    {category.leaders.map((leader, leaderIndex) => (
                      <div className="category-leader" key={leader}>
                        <span className="category-leader-rank">
                          #{leaderIndex + 1}
                        </span>
                        <span
                          className={`category-leader-avatar avatar-tone-${(categoryIndex + leaderIndex) % 5}`}
                        >
                          {leader.slice(0, 1)}
                        </span>
                        <span className="category-leader-name">{leader}</span>
                        <span className="category-leader-price">
                          {formatMoney(
                            Math.max(
                              165,
                              11400 - categoryIndex * 315 - leaderIndex * 138,
                            ),
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="command-strip" id="how-it-works">
            <div className="command-number">01</div>
            <div>
              <span className="eyebrow">THE RULE</span>
              <strong>One auction. One ladder.</strong>
            </div>
            <div className="command-divider" />
            <div className="command-number">02</div>
            <div>
              <span className="eyebrow">THE RHYTHM</span>
              <strong>12H live / 12H locked.</strong>
            </div>
            <div className="command-divider" />
            <div className="command-number">03</div>
            <div>
              <span className="eyebrow">THE FEELING</span>
              <strong>Spend. Rise. Be remembered.</strong>
            </div>
          </section>

          <section className="editorial-grid" id="articles">
            <div className="section-heading">
              <div>
                <p className="kicker">
                  <BookOpen size={13} /> FROM THE EDITORIAL DESK
                </p>
                <h2>What the market is saying.</h2>
              </div>
              <a href="#magazine">
                OPEN THE MAGAZINE <ChevronRight size={14} />
              </a>
            </div>
            <div className="article-cards">
              <article className="article-card feature-card">
                <div className="article-index">
                  01 <span>FIELD NOTE</span>
                </div>
                <h3>The price of being seen.</h3>
                <p>
                  Visibility is no longer a vanity metric. It is a position you
                  can take, hold, and defend.
                </p>
                <a href="#magazine">
                  READ NOTE <ArrowUpRight size={14} />
                </a>
              </article>
              <article className="article-card">
                <div className="article-index">
                  02 <span>THE CLOSE</span>
                </div>
                <h3>Why the room changes after lock.</h3>
                <p>12 hours of exposure turn a bid into social proof.</p>
                <a href="#magazine">
                  READ NOTE <ArrowUpRight size={14} />
                </a>
              </article>
              <article className="article-card dark-card">
                <div className="article-index">
                  03 <span>WORLD DESK</span>
                </div>
                <h3>Everyone arrives at a different hour.</h3>
                <p>One shared market makes the overlap the product.</p>
                <a href="#magazine">
                  READ NOTE <ArrowUpRight size={14} />
                </a>
              </article>
            </div>
          </section>

          <section className="magazine-feature" id="magazine">
            <div className="magazine-cover">
              <div className="cover-top">
                <span>BOUGHT</span>
                <span>ISSUE 01</span>
              </div>
              <div className="cover-stamp">
                THE
                <br />
                COST
                <br />
                OF
                <br />
                BEING
                <br />
                <em>SEEN</em>
              </div>
              <div className="cover-bottom">
                <span>GLOBAL ATTENTION EXCHANGE</span>
                <span>2026</span>
              </div>
            </div>
            <div className="magazine-copy">
              <p className="kicker">
                <Sparkles size={13} /> THE VIRTUAL MAGAZINE
              </p>
              <h2>A field guide to having a position.</h2>
              <p>
                Weekly dispatches from the people who spend, climb, and keep the
                room moving. Read the issue while the next auction runs.
              </p>
              <div className="magazine-meta">
                <span>42 PAGES</span>
                <span>6 DISPATCHES</span>
                <span>ONE GLOBAL EDITION</span>
              </div>
              <Button
                className="primary-action magazine-action"
                onClick={() =>
                  setNotice('Issue 01 is queued for the virtual reading room.')
                }
              >
                READ ISSUE 01 <ArrowUpRight size={15} />
              </Button>
            </div>
          </section>

          <footer className="site-footer">
            <div>
              <span className="brand-dot" /> <strong>BOUGHT</strong>
            </div>
            <span>THE GLOBAL ATTENTION EXCHANGE</span>
            <span>UTC / ALWAYS OPEN</span>
          </footer>
        </div>
      </div>

      {(orderOpen || recordOpen) && (
        <dialog
          open
          className="action-drawer"
          aria-label={orderOpen ? 'Order ticket' : 'Recording room'}
        >
          <button
            className="drawer-close"
            onClick={() => {
              setOrderOpen(false);
              setRecordOpen(false);
            }}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
          {orderOpen && selectedRow && (
            <>
              <p className="kicker">
                <Zap size={13} /> ORDER TICKET / {activeMarket.code}
              </p>
              <h2>
                Move above
                <br />
                <em>{selectedRow.name}</em>
              </h2>
              <p className="drawer-subcopy">
                Your spend is your position. If the auction is live, the room
                sees the move immediately.
              </p>
              <div className="ticket-target">
                <div className={`avatar avatar-${selectedRow.color}`}>
                  {selectedRow.initials}
                </div>
                <div>
                  <span>YOU ARE CHASING</span>
                  <strong>
                    {selectedRow.name} / {formatMoney(selectedRow.price)}
                  </strong>
                </div>
              </div>
              <label className="bid-label" htmlFor="bid-input">
                YOUR NEW POSITION
              </label>
              <div className="bid-input-wrap">
                <span>₹</span>
                <input
                  id="bid-input"
                  inputMode="numeric"
                  value={bid}
                  onChange={(event) =>
                    setBid(event.target.value.replace(/[^0-9]/g, ''))
                  }
                />
                <span className="bid-suffix">CREDITS</span>
              </div>
              <div className="ticket-detail">
                <span>INCREMENT</span>
                <strong>
                  {formatMoney(Math.max(0, Number(bid || 0) - myPrice))}
                </strong>
              </div>
              <div className="ticket-detail">
                <span>AFTER THIS MOVE</span>
                <strong>POSITION #01</strong>
              </div>
              <Button
                className="primary-action drawer-action"
                onClick={placeBid}
              >
                PLACE POSITION <ArrowUpRight size={15} />
              </Button>
              <p className="drawer-footnote">
                <LockKeyhole size={12} /> Live auction only. Your balance is not
                charged in this prototype.
              </p>
            </>
          )}
          {recordOpen && (
            <>
              <p className="kicker">
                <Radio size={13} /> RECORDING ROOM
              </p>
              <h2>
                Put a thought
                <br />
                <em>on the tape.</em>
              </h2>
              <p className="drawer-subcopy">
                Make a 30-second take. The room will see it when the next drop
                opens. Camera and moderation are ready for the production build.
              </p>
              <div className="recording-frame">
                <div className="recording-grid" />
                <span className="recording-corner top-left" />
                <span className="recording-corner top-right" />
                <span className="recording-corner bottom-left" />
                <span className="recording-corner bottom-right" />
                <div className="recording-placeholder">
                  <Radio size={24} />
                  <span>CAMERA READY</span>
                </div>
              </div>
              <Button
                className="primary-action drawer-action"
                onClick={() =>
                  setNotice(
                    'Recording room reserved. Your take will enter the next drop.',
                  )
                }
              >
                ENTER RECORDING ROOM <ArrowUpRight size={15} />
              </Button>
              <p className="drawer-footnote">
                <ShieldCheck size={12} /> Every take is attached to one market
                position.
              </p>
            </>
          )}
        </dialog>
      )}

      {notice && (
        <button
          className="toast-notice"
          onClick={() => setNotice('')}
          aria-label="Dismiss notification"
        >
          {notice}
          <X size={14} />
        </button>
      )}
    </main>
  );
}
