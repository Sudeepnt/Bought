'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CircleHelp,
  DollarSign,
  Flame,
  Play,
  UsersRound,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  LiveMarketFeed,
  MarketFooter,
  MarketStatusStrip,
} from '@/components/market-chrome';
import { MarketTopbar } from '@/components/market-topbar';
import { ProfileAvatar } from '@/components/profile-avatar';
import { PublishedLadder } from '@/components/published-ladder';

const leaderboard = [
  ['Ananya R.', '@ananyabuilds', 'UNPOPULAR OPINION', '$11,400', 'AR', 'coral'],
  ['Arjun S.', '@arjunsays', 'BUILDING', '$8,900', 'AS', 'green'],
  ['Priya M.', '@priyamakes', 'MONEY', '$6,200', 'PM', 'orange'],
  ['Rahul K.', '@rahulbuilds', 'BEEF', '$6,200', 'RK', 'blue'],
  ['Karan V.', '@karanv', 'UNPOPULAR OPINION', '$4,800', 'KV', 'purple'],
];

const activity = [
  ['Rahul K.', 'took #4 in', 'BEEF', '$6,200', '12s ago', 'RK', 'blue'],
  ['Priya M.', 'entered', 'MONEY', '$4,100', '21s ago', 'PM', 'orange'],
  [
    'Arjun S.',
    'moved to #2 in',
    'BUILDING',
    '$8,900',
    '31s ago',
    'AS',
    'green',
  ],
  [
    'Karan V.',
    'outbid in',
    'UNPOPULAR OPINION',
    '$11,500',
    '45s ago',
    'KV',
    'purple',
  ],
  ['Someone just joined', 'from', 'Bengaluru', '', '1m ago', 'SJ', 'coral'],
];

const homeCategories = [
  ['ALL', '1,155'],
  ['BEEF', '184'],
  ['CHAOS', '28'],
  ['UNPOPULAR OPINION', '162'],
  ['I WAS WRONG', '141'],
  ['THE RANT', '118'],
  ['CONFESSIONS', '96'],
  ['MONEY I SET ON FIRE', '88'],
  ['THE PITCH THAT GOT REJECTED', '74'],
  ['BUILDING', '69'],
  ['THE ASK', '61'],
  ['HIRING', '54'],
  ['AGENCY ROW', '43'],
  ['INDIAN D2C', '37'],
] as const;

const categoryPulse = [
  {
    name: 'Unpopular Opinion',
    key: 'UNPOPULAR OPINION',
    bids: '1,420',
    positive: true,
    tone: 'red',
    icon: Flame,
    path: 'M2 15 C8 13 8 8 13 11 S19 9 24 5 S29 8 34 4',
  },
  {
    name: 'Money',
    key: 'MONEY',
    bids: '980',
    positive: true,
    tone: 'green',
    icon: DollarSign,
    path: 'M2 16 C8 16 7 13 12 13 S17 8 22 10 S27 5 34 5',
  },
  {
    name: 'Building',
    key: 'BUILDING',
    bids: '760',
    positive: true,
    tone: 'blue',
    icon: Building2,
    path: 'M2 15 C8 12 7 14 12 11 S18 12 21 8 S27 9 34 6',
  },
  {
    name: 'The Ask',
    key: 'THE ASK',
    bids: '620',
    positive: false,
    tone: 'purple',
    icon: CircleHelp,
    path: 'M2 7 C8 9 9 13 14 10 S19 12 22 16 S28 13 34 17',
  },
  {
    name: 'Hiring',
    key: 'HIRING',
    bids: '540',
    positive: true,
    tone: 'orange',
    icon: UsersRound,
    path: 'M2 16 C8 12 9 15 13 12 S18 13 22 10 S28 11 34 8',
  },
] as const;

const trending = [
  [
    'I switched from Notion to Anytype. Here’s why.',
    '$9,200',
    'WHY I SWITCHED',
    '1:36',
    'RK',
    'blue',
  ],
  [
    'We spent $50,000 on LinkedIn ads. Here are the results.',
    '$7,800',
    'SHOW THE RECEIPTS',
    '2:12',
    'PM',
    'orange',
  ],
  [
    'Is Claude still worth $30 when Kimi K3 does it for $3?',
    '$6,400',
    'WORTH IT?',
    '1:48',
    'EC',
    'green',
  ],
  [
    'Roast my landing page. Be brutal.',
    '$5,900',
    'TEARDOWN',
    '2:05',
    'AS',
    'coral',
  ],
  [
    'You said AI can replace SDRs. Prove it.',
    '$5,900',
    'PROVE IT?',
    '1:22',
    'KV',
    'purple',
  ],
  [
    "Reacting to Y Combinator's new AI fund.",
    '$4,600',
    'REACT',
    '3:14',
    'AR',
    'blue',
  ],
];

function Money({ value }: { value: string }) {
  return <span className="dashboard-money">{value}</span>;
}

function Avatar({
  initials,
  tone = 'coral',
}: {
  initials: string;
  tone?: string;
}) {
  return (
    <ProfileAvatar
      initials={initials}
      className={`dashboard-avatar avatar-${tone}`}
    />
  );
}

function Delta({ value, down = false }: { value: string; down?: boolean }) {
  return (
    <span className={`dashboard-delta ${down ? 'is-down' : ''}`}>
      {down ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
      {value}
    </span>
  );
}

function PulseSparkline({
  path,
  positive,
}: {
  path: string;
  positive: boolean;
}) {
  return (
    <svg
      className={`category-pulse-sparkline ${positive ? 'is-up' : 'is-down'}`}
      viewBox="0 0 36 20"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function Home() {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [activityFeed, setActivityFeed] = useState(activity);
  const [activityPulse, setActivityPulse] = useState<{
    id: number;
    amount: string;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    let cursor = 0;
    let pulseTimeout: number | undefined;

    const publishNextActivity = () => {
      const source = activity[cursor % activity.length];
      const freshEvent = [...source];
      freshEvent[4] = 'just now';
      const eventId = cursor + 1;
      cursor += 1;

      setActivityFeed((current) => [
        freshEvent,
        ...current.slice(0, -1).map((row, index) => {
          const agedEvent = [...row];
          agedEvent[4] = `${(index + 1) * 5}s ago`;
          return agedEvent;
        }),
      ]);

      if (freshEvent[3]) {
        setActivityPulse({ id: eventId, amount: freshEvent[3] });
        window.clearTimeout(pulseTimeout);
        pulseTimeout = window.setTimeout(() => setActivityPulse(null), 1400);
      } else {
        setActivityPulse(null);
      }
    };

    const timer = window.setInterval(publishNextActivity, 5000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pulseTimeout);
    };
  }, []);

  useEffect(() => {
    if (!reviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReviewOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [reviewOpen]);

  function submitReview(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewText.trim()) return;
    setReviewSent(true);
    setReviewText('');
  }

  return (
    <main className="market-shell dashboard-shell">
      <div className="scanlines" aria-hidden="true" />
      <MarketTopbar
        active="floor"
        activityItems={activityFeed.map(
          ([name, action, category, amount, time]) =>
            `${name} ${action} ${category} ${amount} ${time}`,
        )}
      />

      <div className="dashboard-wrap">
        <MarketStatusStrip />
        <LiveMarketFeed />
        <PublishedLadder compact />
        <p className="market-example-label">MARKET PREVIEW · EXAMPLE CONTENT BELOW</p>

        <section
          className="homepage-category-selector dashboard-panel"
          aria-label="Choose a market category"
        >
          <div className="dashboard-section-head">
            <span>CATEGORIES</span>
            <Link href="/categories">VIEW ALL</Link>
          </div>
          <div
            className="homepage-category-list"
            role="tablist"
            aria-label="Market categories"
          >
            {homeCategories.map(([category, bids]) => (
              <button
                className={`homepage-category-option ${activeCategory === category ? 'is-active' : ''}`}
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                <strong>{category}</strong>
                <span>{bids} bids</span>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-top-grid">
          <article className="leader-spot dashboard-panel">
            <div className="dashboard-section-head">
              <span>
                TOP POSITION RIGHT NOW <i /> LIVE
              </span>
            </div>
            <div className="leader-visual">
              <div className="leader-portrait">
                <Image
                  src="/ananya-rao-hero.webp"
                  alt="Ananya Rao, current leader"
                  width="1672"
                  height="941"
                  fetchPriority="high"
                  priority
                />
              </div>
              <div className="leader-overlay">
                <strong className="leader-rank">#1</strong>
                <span className="leader-category">UNPOPULAR OPINION</span>
                <Money value="$11,400" />
                <div className="leader-metrics">
                  <span>14,201 VIEWS</span>
                  <Delta value="6 OUTBID" />
                </div>
                <p>
                  “Your design
                  <br />
                  system is a<br />
                  productivity
                  <br />
                  theatre.”
                </p>
                <div className="leader-person">
                  <strong>ANANYA R.</strong>
                  <span>@ananyabuilds</span>
                  <small>Founder · DesignOps</small>
                </div>
                <button
                  className="hero-play"
                  type="button"
                  onClick={() => setVideoPlaying((value) => !value)}
                  aria-label={
                    videoPlaying ? 'Pause broadcast' : 'Play broadcast'
                  }
                >
                  {videoPlaying ? 'Ⅱ' : <Play size={22} fill="currentColor" />}
                </button>
                <Link
                  className="leader-cta"
                  href="/drop?category=UNPOPULAR%20OPINION"
                  aria-label="Take this spot for $11,500"
                >
                  <span>TAKE THIS SPOT</span>
                  <strong>$11,500</strong>
                </Link>
              </div>
            </div>
          </article>

          <section className="leaderboard-panel dashboard-panel">
            <div className="dashboard-section-head">
              <span>TODAY&apos;S LEADERBOARD</span>
              <Link href="/global-index">VIEW ALL</Link>
            </div>
            <div className="leaderboard-list">
              {leaderboard.map(
                ([name, handle, category, price, initials, tone], index) => (
                  <button
                    className={`leaderboard-row ${index === 0 ? 'is-top' : ''}`}
                    type="button"
                    key={name}
                  >
                    <span className="leaderboard-rank">{index + 1}</span>
                    <Avatar initials={initials} tone={tone} />
                    <span className="leaderboard-person">
                      <strong>{name}</strong>
                      <small>{handle}</small>
                    </span>
                    <span className="leaderboard-category">{category}</span>
                    <strong className="leaderboard-price">{price}</strong>
                  </button>
                ),
              )}
            </div>
            <Link className="panel-footer-link" href="/global-index">
              VIEW FULL BOARD <ArrowUpRight size={13} />
            </Link>
          </section>

          <section className="activity-dashboard dashboard-panel">
            <div className="dashboard-section-head">
              <span>LIVE ACTIVITY</span>
            </div>
            <div
              className="activity-dashboard-list"
              aria-live="polite"
              aria-atomic="false"
            >
              {activityFeed.map(
                (
                  [name, action, category, amount, time, initials, tone],
                  index,
                ) => (
                  <button
                    className={`activity-dashboard-row ${index === 0 && activityPulse ? 'is-new' : ''}`}
                    type="button"
                    key={`${name}-${category}-${time}-${index}`}
                  >
                    <Avatar initials={initials} tone={tone} />
                    <span>
                      <strong>{name}</strong>
                      <small>
                        {action} <b>{category}</b>
                      </small>
                      {amount && <em>{amount}</em>}
                    </span>
                    <time>{time}</time>
                    {index === 0 && activityPulse && amount && (
                      <span
                        className="activity-money-pulse"
                        aria-label={`New money added ${amount}`}
                      >
                        +{amount}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </section>
        </section>

        <section className="dashboard-mid-grid dashboard-mid-grid-compact">
          <section className="revenue-dashboard dashboard-panel">
            <div className="dashboard-section-head">
              <span>
                TOTAL REVENUE <small>(ALL TIME)</small>
              </span>
            </div>
            <Money value="$18,432,220" />
            <div className="revenue-chart" aria-label="Revenue chart">
              <span style={{ height: '22%' }} />
              <span style={{ height: '31%' }} />
              <span style={{ height: '38%' }} />
              <span style={{ height: '49%' }} />
              <span style={{ height: '62%' }} />
              <span style={{ height: '82%' }} />
            </div>
            <div className="revenue-months">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
            </div>
            <small className="chart-note">
              365 DAYS · 12 CATEGORIES · 1 MARKET
            </small>
          </section>

          <div className="dashboard-side-stack">
            <section className="category-pulse-dashboard dashboard-panel">
              <div className="dashboard-section-head">
                <span>CATEGORY PULSE</span>
                <Link href="/categories">
                  VIEW ALL <ArrowUpRight size={11} />
                </Link>
              </div>
              <div className="category-pulse-list">
                {categoryPulse.map(
                  ({
                    name,
                    key,
                    bids,
                    positive,
                    tone,
                    icon: Icon,
                    path,
                  }) => (
                    <button
                      className="category-pulse-row"
                      key={key}
                      type="button"
                      aria-pressed={activeCategory === key}
                      onClick={() => setActiveCategory(key)}
                    >
                      <span className={`category-pulse-icon pulse-${tone}`}>
                        <Icon size={15} strokeWidth={2.2} />
                      </span>
                      <strong>{name}</strong>
                      <PulseSparkline path={path} positive={positive} />
                      <span className="category-pulse-bids category-pulse-total">
                        {bids} BIDS
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>
            <article className="review-dashboard dashboard-panel">
              <div className="review-dashboard-body">
                <ProfileAvatar
                  initials="JB"
                  className="review-avatar"
                  alt="Arnav, Indie Hacker"
                />
                <div className="review-copy">
                  <p>
                    &ldquo;This platform cuts through the fake noise. Love
                    it.&rdquo;
                  </p>
                  <span>— Arnav, Indie Hacker</span>
                </div>
              </div>
              <button
                className="review-add-trigger"
                type="button"
                onClick={() => {
                  setReviewSent(false);
                  setReviewOpen(true);
                }}
              >
                ADD A REVIEW
              </button>
            </article>
          </div>
        </section>

        {reviewOpen && (
          <div
            className="review-modal"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setReviewOpen(false);
            }}
          >
            <dialog
              open
              className="review-dialog"
              aria-labelledby="review-title"
              aria-describedby="review-description"
            >
              <button
                className="review-close"
                type="button"
                onClick={() => setReviewOpen(false)}
                aria-label="Close review form"
              >
                ×
              </button>
              <header>
                <h2 id="review-title">Share your BOUGHT review</h2>
                <p id="review-description">
                  Tell the room what feels different about having a real
                  position on the ladder.
                </p>
              </header>
              {reviewSent ? (
                <div className="review-success">
                  Review sent. Thanks for adding your voice to the room.
                </div>
              ) : (
                <form className="review-form" onSubmit={submitReview}>
                  <label htmlFor="review-text">Your review</label>
                  <textarea
                    autoFocus
                    id="review-text"
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="What do you think of BOUGHT?"
                    maxLength={280}
                    required
                  />
                  <div className="review-dialog-footer">
                    <button type="submit" disabled={!reviewText.trim()}>
                      SEND REVIEW
                    </button>
                  </div>
                </form>
              )}
            </dialog>
          </div>
        )}

        <section className="trending-dashboard dashboard-panel">
          <div className="dashboard-section-head">
            <span>TRENDING BROADCASTS</span>
            <Link href="/categories">VIEW ALL</Link>
          </div>
          <div className="trending-row">
            {trending.map(([title, price, tag, duration, initials, tone]) => (
              <article className="trending-card" key={title}>
                <div className={`trend-thumb avatar-${tone}`}>
                  <Avatar initials={initials} tone={tone} />
                  <span>{duration}</span>
                </div>
                <h3>{title}</h3>
                <span className={`trend-tag tone-${tone}`}>{tag}</span>
                <strong>{price}</strong>
              </article>
            ))}
          </div>
        </section>

        <MarketFooter />
      </div>
    </main>
  );
}
