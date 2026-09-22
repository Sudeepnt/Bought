'use client';

import { Eye, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';

type WatchPosition = {
  rank: string;
  initials: string;
  portraitPosition: string;
  name: string;
  handle: string;
  category: string;
  bid: string;
  watching: string;
  movement: string;
  movementPercent: string;
  movementValue: number;
  direction: 'up' | 'down' | 'steady';
  audience: number;
  trend: string;
  status: 'HOT' | 'RISING' | 'WATCHING' | 'STEADY';
  saved: boolean;
  biddingToday: boolean;
};

const watchlist: WatchPosition[] = [
  {
    rank: '01',
    initials: 'AN',
    portraitPosition: '25% 0%',
    name: 'Ananya Rao',
    handle: '@ananyabuilds',
    category: 'BEEF',
    bid: '$18,200',
    watching: '8,200',
    movement: '+$1,340',
    movementPercent: '+7.9%',
    movementValue: 1340,
    direction: 'up',
    audience: 100,
    trend: '2,18 11,15 20,17 29,10 37,12 45,6 53,9 61,2 70,5',
    status: 'HOT',
    saved: true,
    biddingToday: true,
  },
  {
    rank: '02',
    initials: 'RK',
    portraitPosition: '100% 0%',
    name: 'Rahul K.',
    handle: '@rahulbuilds',
    category: 'BEEF',
    bid: '$18,047',
    watching: '8,100',
    movement: '+$920',
    movementPercent: '+5.4%',
    movementValue: 920,
    direction: 'up',
    audience: 98,
    trend: '2,18 11,16 20,18 29,12 37,14 45,8 53,10 61,4 70,6',
    status: 'RISING',
    saved: false,
    biddingToday: true,
  },
  {
    rank: '03',
    initials: 'KV',
    portraitPosition: '50% 0%',
    name: 'Karan V.',
    handle: '@karanv',
    category: 'CHAOS',
    bid: '$17,832',
    watching: '8,100',
    movement: '-$640',
    movementPercent: '-3.5%',
    movementValue: -640,
    direction: 'down',
    audience: 98,
    trend: '2,5 11,9 20,12 29,16 37,13 45,18 53,15 61,19 70,16',
    status: 'WATCHING',
    saved: true,
    biddingToday: true,
  },
  {
    rank: '04',
    initials: 'MC',
    portraitPosition: '0% 100%',
    name: 'Maya Chen',
    handle: '@mayachen',
    category: 'THE RANT',
    bid: '$17,741',
    watching: '8,300',
    movement: '+$480',
    movementPercent: '+2.8%',
    movementValue: 480,
    direction: 'up',
    audience: 99,
    trend: '2,17 11,13 20,14 29,8 37,10 45,6 53,8 61,2 70,4',
    status: 'RISING',
    saved: false,
    biddingToday: true,
  },
  {
    rank: '05',
    initials: 'AS',
    portraitPosition: '0% 0%',
    name: 'Arjun S.',
    handle: '@arjunsays',
    category: 'BUILDING',
    bid: '$15,620',
    watching: '6,400',
    movement: '+$310',
    movementPercent: '+2.0%',
    movementValue: 310,
    direction: 'up',
    audience: 78,
    trend: '2,17 11,13 20,15 29,10 37,12 45,9 53,11 61,8 70,10',
    status: 'STEADY',
    saved: false,
    biddingToday: true,
  },
  {
    rank: '06',
    initials: 'PM',
    portraitPosition: '75% 0%',
    name: 'Priya M.',
    handle: '@priyamakes',
    category: 'THE ASK',
    bid: '$14,900',
    watching: '5,800',
    movement: '—',
    movementPercent: '0.0%',
    movementValue: 0,
    direction: 'steady',
    audience: 71,
    trend: '2,16 11,13 20,15 29,11 37,12 45,10 53,12 61,10 70,11',
    status: 'STEADY',
    saved: true,
    biddingToday: true,
  },
  {
    rank: '07',
    initials: 'EC',
    portraitPosition: '25% 100%',
    name: 'Ethan Cole',
    handle: '@ethancole',
    category: 'THE PITCH',
    bid: '$14,240',
    watching: '5,200',
    movement: '+$220',
    movementPercent: '+1.6%',
    movementValue: 220,
    direction: 'up',
    audience: 63,
    trend: '2,17 11,14 20,15 29,9 37,11 45,8 53,10 61,5 70,7',
    status: 'WATCHING',
    saved: false,
    biddingToday: true,
  },
  {
    rank: '08',
    initials: 'NP',
    portraitPosition: '75% 100%',
    name: 'Nia Patel',
    handle: '@niapatel',
    category: 'UNPOPULAR OPINION',
    bid: '$13,860',
    watching: '4,900',
    movement: '-$410',
    movementPercent: '-2.9%',
    movementValue: -410,
    direction: 'down',
    audience: 60,
    trend: '2,6 11,8 20,12 29,10 37,15 45,13 53,17 61,16 70,20',
    status: 'STEADY',
    saved: false,
    biddingToday: true,
  },
];

function Movement({ position }: { position: WatchPosition }) {
  const glyph =
    position.direction === 'up'
      ? '▲'
      : position.direction === 'down'
        ? '▼'
        : '—';
  return (
    <span
      className={`watchlist-movement is-${position.direction}`}
      aria-label={`${position.movement} ${position.movementPercent}`}
    >
      <span className="watchlist-change-glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="watchlist-change-values">
        <strong>{position.movement}</strong>
        <small>{position.movementPercent}</small>
      </span>
    </span>
  );
}

function TrendSparkline({ position }: { position: WatchPosition }) {
  return (
    <svg
      className={`watchlist-trend is-${position.direction}`}
      viewBox="0 0 72 24"
      aria-hidden="true"
    >
      <polyline points={position.trend} />
    </svg>
  );
}

export default function WatchlistPage() {
  return (
    <MarketPageShell
      active="watchlist"
      eyebrow="YOUR WATCHLIST / 08 POSITIONS"
      title="Your market watch desk."
      description="See what moved, where attention is building, and which positions need a closer look."
      showIntro={false}
    >
      <WatchlistDesk />
    </MarketPageShell>
  );
}

function WatchlistDesk() {
  const [query, setQuery] = useState('');
  const [removedPositions, setRemovedPositions] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleWatchlist = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return watchlist.filter((position) => {
      if (!position.biddingToday || removedPositions.has(position.name)) {
        return false;
      }

      const matchesQuery =
        !normalizedQuery ||
        `${position.name} ${position.handle} ${position.category}`
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesQuery;
    });
  }, [query, removedPositions]);

  function removePosition(name: string) {
    setRemovedPositions((current) => {
      const next = new Set(current);
      next.add(name);
      return next;
    });
  }

  return (
    <section className="watchlist-layout watchlist-workspace">
      <div className="route-panel watchlist-panel">
        <header className="watchlist-heading">
          <div>
            <h3>My Watchlist</h3>
          </div>
          <label className="watchlist-search">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Search watchlist</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or categories..."
            />
          </label>
        </header>

        <div className="watchlist-table" aria-label="My watchlist positions">
          <div className="watchlist-table-head">
            <span>#</span>
            <span>PERSON</span>
            <span>CATEGORY</span>
            <span>CURRENT BID</span>
            <span>24H CHANGE</span>
            <span>ATTENTION</span>
            <span>TREND</span>
            <span>STATUS</span>
            <span aria-label="Saved" />
          </div>

          {visibleWatchlist.length > 0 ? (
            visibleWatchlist.map((position, index) => {
              return (
                <article className="watchlist-row" key={position.name}>
                  <span className="watch-rank">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="watchlist-identity">
                    <ProfileAvatar
                      initials={position.initials}
                      className="watch-avatar"
                      imageSrc="/leaderboard-portraits.png"
                      imagePosition={position.portraitPosition}
                    />
                    <span className="watch-player">
                      <strong>{position.name}</strong>
                      <small>{position.handle}</small>
                    </span>
                  </div>

                  <span className="watchlist-category">
                    {position.category}
                  </span>

                  <span className="watchlist-bid">
                    <small className="watchlist-cell-label">CURRENT BID</small>
                    <strong>{position.bid}</strong>
                  </span>

                  <span className="watchlist-movement-cell">
                    <small className="watchlist-cell-label">24H CHANGE</small>
                    <Movement position={position} />
                  </span>

                  <span className="watchlist-attention">
                    <span>
                      <Eye size={14} aria-hidden="true" />
                      <strong>{position.watching}</strong>
                    </span>
                  </span>

                  <TrendSparkline position={position} />

                  <span
                    className={`watchlist-state is-${position.status.toLowerCase()}`}
                  >
                    {position.status}
                  </span>

                  <button
                    className="watchlist-remove"
                    type="button"
                    aria-label={`Remove ${position.name} from watchlist`}
                    onClick={() => removePosition(position.name)}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </article>
              );
            })
          ) : (
            <p className="watchlist-empty">No positions match this view.</p>
          )}
        </div>
      </div>
    </section>
  );
}
