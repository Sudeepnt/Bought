import {
  BellRing,
  Eye,
  Flame,
  Minus,
  Radio,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

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
  direction: 'up' | 'down' | 'steady';
  audience: number;
  status: 'HOT' | 'MOVING' | 'STEADY';
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
    watching: '8.2k',
    movement: '+$1,340',
    movementPercent: '+7.9%',
    direction: 'up',
    audience: 100,
    status: 'HOT',
  },
  {
    rank: '02',
    initials: 'RK',
    portraitPosition: '100% 0%',
    name: 'Rahul K.',
    handle: '@rahulbuilds',
    category: 'BEEF',
    bid: '$18,047',
    watching: '8.1k',
    movement: '+$920',
    movementPercent: '+5.4%',
    direction: 'up',
    audience: 98,
    status: 'HOT',
  },
  {
    rank: '03',
    initials: 'KV',
    portraitPosition: '50% 0%',
    name: 'Karan V.',
    handle: '@karanv',
    category: 'CHAOS',
    bid: '$17,832',
    watching: '8.1k',
    movement: '-$640',
    movementPercent: '-3.5%',
    direction: 'down',
    audience: 98,
    status: 'MOVING',
  },
  {
    rank: '04',
    initials: 'MC',
    portraitPosition: '0% 100%',
    name: 'Maya Chen',
    handle: '@mayachen',
    category: 'THE RANT',
    bid: '$17,741',
    watching: '8.0k',
    movement: '+$480',
    movementPercent: '+2.8%',
    direction: 'up',
    audience: 96,
    status: 'MOVING',
  },
  {
    rank: '05',
    initials: 'AS',
    portraitPosition: '0% 0%',
    name: 'Arjun S.',
    handle: '@arjunsays',
    category: 'BUILDING',
    bid: '$15,620',
    watching: '6.4k',
    movement: 'NO CHANGE',
    movementPercent: '1H',
    direction: 'steady',
    audience: 78,
    status: 'STEADY',
  },
  {
    rank: '06',
    initials: 'PM',
    portraitPosition: '75% 0%',
    name: 'Priya M.',
    handle: '@priyamakes',
    category: 'THE ASK',
    bid: '$14,900',
    watching: '5.8k',
    movement: 'NO CHANGE',
    movementPercent: '1H',
    direction: 'steady',
    audience: 71,
    status: 'STEADY',
  },
  {
    rank: '07',
    initials: 'EC',
    portraitPosition: '25% 100%',
    name: 'Ethan Cole',
    handle: '@ethancole',
    category: 'THE PITCH',
    bid: '$14,240',
    watching: '5.2k',
    movement: 'NO CHANGE',
    movementPercent: '1H',
    direction: 'steady',
    audience: 63,
    status: 'STEADY',
  },
  {
    rank: '08',
    initials: 'NP',
    portraitPosition: '75% 100%',
    name: 'Nia Patel',
    handle: '@niapatel',
    category: 'UNPOPULAR OPINION',
    bid: '$13,860',
    watching: '4.9k',
    movement: 'NO CHANGE',
    movementPercent: '1H',
    direction: 'steady',
    audience: 60,
    status: 'STEADY',
  },
];

const watchlistMix = [
  { category: 'BEEF', count: 2, share: 25 },
  { category: 'CHAOS', count: 1, share: 12.5 },
  { category: 'THE RANT', count: 1, share: 12.5 },
  { category: 'OTHER ROOMS', count: 4, share: 50 },
];

function Movement({ position }: { position: WatchPosition }) {
  if (position.direction === 'up') {
    return (
      <span className="watchlist-movement is-up">
        <TrendingUp size={16} aria-hidden="true" />
        <span>
          <strong>{position.movement}</strong>
          <small>{position.movementPercent}</small>
        </span>
      </span>
    );
  }

  if (position.direction === 'down') {
    return (
      <span className="watchlist-movement is-down">
        <TrendingDown size={16} aria-hidden="true" />
        <span>
          <strong>{position.movement}</strong>
          <small>{position.movementPercent}</small>
        </span>
      </span>
    );
  }

  return (
    <span className="watchlist-movement is-steady">
      <Minus size={16} aria-hidden="true" />
      <span>
        <strong>{position.movement}</strong>
        <small>{position.movementPercent}</small>
      </span>
    </span>
  );
}

export default function WatchlistPage() {
  return (
    <MarketPageShell
      active="watchlist"
      eyebrow="YOUR WATCHLIST / 08 POSITIONS"
      title="Your market watch desk."
      description="See what moved, where attention is building, and which positions need a closer look."
    >
      <section className="watchlist-summary" aria-label="Watchlist summary">
        <article>
          <span className="watchlist-summary-icon">
            <Target size={18} aria-hidden="true" />
          </span>
          <span>
            <small>TRACKING</small>
            <strong>08</strong>
          </span>
          <em>POSITIONS</em>
        </article>
        <article>
          <span className="watchlist-summary-icon is-hot">
            <Zap size={18} aria-hidden="true" />
          </span>
          <span>
            <small>MOVED IN 1H</small>
            <strong>04</strong>
          </span>
          <em>2 NEED ATTENTION</em>
        </article>
        <article>
          <span className="watchlist-summary-icon">
            <Users size={18} aria-hidden="true" />
          </span>
          <span>
            <small>COMBINED AUDIENCE</small>
            <strong>54.7K</strong>
          </span>
          <em>WATCHING NOW</em>
        </article>
        <article>
          <span className="watchlist-summary-icon">
            <Flame size={18} aria-hidden="true" />
          </span>
          <span>
            <small>TIGHTEST GAP</small>
            <strong>$153</strong>
          </span>
          <em>POSITIONS 01–02</em>
        </article>
      </section>

      <section className="watchlist-layout watchlist-workspace">
        <div className="route-panel watchlist-panel">
          <div className="watchlist-panel-head">
            <div>
              <span className="eyebrow">LIVE MONITOR</span>
              <h2>Positions you&apos;re tracking</h2>
              <p>Movement compares each position with its value one hour ago.</p>
            </div>
            <span className="watchlist-count">
              <Radio size={14} aria-hidden="true" /> LIVE
            </span>
          </div>

          <div className="watchlist-table-head" aria-hidden="true">
            <span>RANK</span>
            <span>POSITION</span>
            <span>CURRENT BID</span>
            <span>1H MOVEMENT</span>
            <span>ATTENTION</span>
            <span>STATE</span>
          </div>

          <div className="watchlist-table">
            {watchlist.map((position) => (
              <article className="watchlist-row" key={position.name}>
                <span className="watch-rank">{position.rank}</span>

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
                    <em>{position.category}</em>
                  </span>
                </div>

                <span className="watchlist-bid">
                  <small className="watchlist-cell-label">CURRENT BID</small>
                  <strong>{position.bid}</strong>
                </span>

                <span className="watchlist-movement-cell">
                  <small className="watchlist-cell-label">1H MOVEMENT</small>
                  <Movement position={position} />
                </span>

                <span className="watchlist-attention">
                  <span>
                    <Eye size={14} aria-hidden="true" />
                    <strong>{position.watching}</strong>
                  </span>
                  <span className="watchlist-attention-track" aria-hidden="true">
                    <i style={{ width: `${position.audience}%` }} />
                  </span>
                </span>

                <span className={`watchlist-state is-${position.status.toLowerCase()}`}>
                  {position.status}
                </span>
              </article>
            ))}
          </div>
        </div>

        <aside className="watchlist-side-stack">
          <section className="watchlist-alert-card">
            <header>
              <span className="watchlist-alert-icon">
                <BellRing size={18} aria-hidden="true" />
              </span>
              <span>
                <small>MARKET ALERT</small>
                <strong>2 positions need attention</strong>
              </span>
              <i>LIVE</i>
            </header>

            <div className="watchlist-alert-list">
              <article>
                <span className="watchlist-alert-rank">01</span>
                <span>
                  <strong>Ananya Rao</strong>
                  <small>Now only $153 ahead of #02</small>
                </span>
                <em className="is-up">+$1,340</em>
              </article>
              <article>
                <span className="watchlist-alert-rank">03</span>
                <span>
                  <strong>Karan V.</strong>
                  <small>Largest pullback in your list</small>
                </span>
                <em className="is-down">-$640</em>
              </article>
            </div>

            <p>
              Four watched positions changed in the last hour. The top two are
              now separated by less than one percent.
            </p>
          </section>

          <section className="watchlist-mix-card">
            <header>
              <span>
                <small>WATCHLIST MIX</small>
                <strong>Where your attention sits</strong>
              </span>
              <span>08 TOTAL</span>
            </header>
            <div className="watchlist-mix-list">
              {watchlistMix.map((item) => (
                <div key={item.category}>
                  <span>
                    <strong>{item.category}</strong>
                    <small>{item.count} POSITIONS</small>
                  </span>
                  <span className="watchlist-mix-track" aria-hidden="true">
                    <i style={{ width: `${item.share}%` }} />
                  </span>
                  <em>{item.share}%</em>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </MarketPageShell>
  );
}
