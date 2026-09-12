'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CircleHelp,
  Crown,
  DollarSign,
  FileText,
  Flame,
  Megaphone,
  MessageCircle,
  Play,
  Radio,
  Store,
  Undo2,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/site-link';

import { MarketFooter } from '@/components/market-chrome';
import { MarketTopbar } from '@/components/market-topbar';
import { DropPlayer } from '@/components/drop-player';
import { useBought } from '@/components/bought-provider';
import { ProfileAvatar } from '@/components/profile-avatar';
import { latestIssue } from '@/lib/magazine';

type LeaderboardRow = [
  string,
  string,
  string,
  string,
  string,
  string,
];

const leaderboard: LeaderboardRow[] = [
  ['Ananya R.', '@ananyabuilds', 'UNPOPULAR OPINION', '$11,400', 'AR', 'coral'],
  ['Arjun S.', '@arjunsays', 'BUILDING', '$8,900', 'AS', 'green'],
  ['Priya M.', '@priyamakes', 'MONEY', '$6,200', 'PM', 'orange'],
  ['Rahul K.', '@rahulbuilds', 'BEEF', '$6,200', 'RK', 'blue'],
  ['Karan V.', '@karanv', 'UNPOPULAR OPINION', '$4,800', 'KV', 'purple'],
  ['Maya K.', '@mayaknowsthis', 'THE RANT', '$4,200', 'MK', 'green'],
  ['Dev P.', '@devpicks', 'THE ASK', '$3,900', 'DP', 'blue'],
  ['Simran N.', '@simrannotes', 'MONEY I SET ON FIRE', '$3,600', 'SN', 'orange'],
  ['Kabir J.', '@kabirj', 'BUILDING', '$3,200', 'KJ', 'coral'],
  ['Aisha T.', '@aishatellsit', 'CONFESSIONS', '$2,900', 'AT', 'purple'],
];

type LeaderboardSelection = {
  rank: number;
  name: string;
  handle: string;
  category: string;
  price: string;
  initials: string;
  tone: string;
  dropId: string | null;
};

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

const homeCategoryIcons: Record<string, LucideIcon> = {
  ALL: Flame,
  BEEF: MessageCircle,
  CHAOS: Zap,
  'UNPOPULAR OPINION': Radio,
  'I WAS WRONG': Undo2,
  'THE RANT': Megaphone,
  CONFESSIONS: MessageCircle,
  'MONEY I SET ON FIRE': DollarSign,
  'THE PITCH THAT GOT REJECTED': FileText,
  BUILDING: Building2,
  'THE ASK': CircleHelp,
  HIRING: Briefcase,
  'AGENCY ROW': UsersRound,
  'INDIAN D2C': Store,
};

const categoryLeaderBidCaps: Record<string, number> = {
  BEEF: 9_800,
  CHAOS: 7_600,
  'UNPOPULAR OPINION': 11_400,
  'I WAS WRONG': 8_700,
  'THE RANT': 8_100,
  CONFESSIONS: 6_800,
  'MONEY I SET ON FIRE': 9_200,
  'THE PITCH THAT GOT REJECTED': 7_400,
  BUILDING: 8_900,
  'THE ASK': 6_500,
  HIRING: 6_200,
  'AGENCY ROW': 5_800,
  'INDIAN D2C': 7_100,
};

const categoryLeaderOffsets: Record<string, number> = {
  BEEF: 3,
  CHAOS: 5,
  'UNPOPULAR OPINION': 0,
  'I WAS WRONG': 6,
  'THE RANT': 1,
  CONFESSIONS: 9,
  'MONEY I SET ON FIRE': 2,
  'THE PITCH THAT GOT REJECTED': 4,
  BUILDING: 1,
  'THE ASK': 6,
  HIRING: 7,
  'AGENCY ROW': 8,
  'INDIAN D2C': 5,
};

const categoryLeaderboards: Record<string, LeaderboardRow[]> =
  Object.fromEntries(
    homeCategories.map(([category], categoryIndex) => {
      if (category === 'ALL') return [category, leaderboard];

      const cap = categoryLeaderBidCaps[category] ?? 6_000;
      const step = Math.max(250, Math.round(cap / 18));
      const offset = categoryLeaderOffsets[category] ?? categoryIndex;
      const rows = Array.from({ length: 10 }, (_, rank) => {
        const source = leaderboard[(offset + rank) % leaderboard.length];
        const row: LeaderboardRow = [
          source[0],
          source[1],
          category,
          `$${Math.max(1_900, cap - rank * step).toLocaleString('en-US')}`,
          source[4],
          source[5],
        ];
        return row;
      });

      return [category, rows];
    }),
  );

const categoryPulse = [
  {
    name: 'Unpopular Opinion',
    key: 'UNPOPULAR OPINION',
    bids: '1,420',
    positive: true,
    path: 'M2 15 C8 13 8 8 13 11 S19 9 24 5 S29 8 34 4',
  },
  {
    name: 'Money',
    key: 'MONEY I SET ON FIRE',
    bids: '980',
    positive: true,
    path: 'M2 16 C8 16 7 13 12 13 S17 8 22 10 S27 5 34 5',
  },
  {
    name: 'Building',
    key: 'BUILDING',
    bids: '760',
    positive: true,
    path: 'M2 15 C8 12 7 14 12 11 S18 12 21 8 S27 9 34 6',
  },
  {
    name: 'The Ask',
    key: 'THE ASK',
    bids: '620',
    positive: false,
    path: 'M2 7 C8 9 9 13 14 10 S19 12 22 16 S28 13 34 17',
  },
  {
    name: 'Hiring',
    key: 'HIRING',
    bids: '540',
    positive: true,
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
  showCrown = false,
}: {
  initials: string;
  tone?: string;
  showCrown?: boolean;
}) {
  const portraitPositions: Record<string, string> = {
    AR: '25% 0%',
    AS: '0% 0%',
    PM: '75% 0%',
    RK: '100% 0%',
    KV: '50% 0%',
    MK: '0% 100%',
    DP: '25% 100%',
    SN: '50% 100%',
    KJ: '75% 100%',
    AT: '100% 100%',
    SJ: '25% 0%',
    EC: '50% 0%',
  };

  return (
    <span className={showCrown ? 'leaderboard-avatar-wrap has-crown' : undefined}>
      <ProfileAvatar
        initials={initials}
        className={`dashboard-avatar avatar-${tone}`}
        imageSrc="/leaderboard-portraits.png"
        imagePosition={portraitPositions[initials] ?? '50% 50%'}
      />
      {showCrown && (
        <Crown
          className="leaderboard-crown"
          size={22}
          strokeWidth={2}
          fill="currentColor"
          aria-label="Current leader"
        />
      )}
    </span>
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
  const { entries } = useBought();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [selectedLeaderboard, setSelectedLeaderboard] =
    useState<LeaderboardSelection | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const displayedLeaderboard =
    categoryLeaderboards[activeCategory] ?? categoryLeaderboards.ALL;

  function selectCategory(category: string) {
    setActiveCategory(category);
    setSelectedLeaderboard(null);
  }

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

  function openLeaderboardBroadcast(row: string[], index: number) {
    const [name, handle, category, price, initials, tone] = row;
    const publishedEntry = entries.find(
      (entry) =>
        entry.position === index + 1 &&
        (activeCategory === 'ALL' || entry.category === category),
    );
    setSelectedLeaderboard({
      rank: index + 1,
      name,
      handle,
      category,
      price,
      initials,
      tone,
      dropId: publishedEntry?.drop_id ?? null,
    });
  }

  function submitReview(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewText.trim()) return;
    setReviewSent(true);
    setReviewText('');
  }

  return (
    <main className="market-shell dashboard-shell">
      <div className="scanlines" aria-hidden="true" />
      <MarketTopbar active="floor" />

      <div className="dashboard-wrap homepage-content-wrap">
        <section className="dashboard-main-grid">
          <div className="dashboard-primary-stack">
            <article className="leader-spot dashboard-panel">
              <div className="dashboard-section-head">
                <span>
                  {selectedLeaderboard
                    ? 'SELECTED BROADCAST'
                    : 'TOP POSITION RIGHT NOW'}{' '}
                  <i /> {selectedLeaderboard ? 'FROM LEADERBOARD' : 'LIVE'}
                </span>
                {selectedLeaderboard && (
                  <button
                    className="leader-clear-selection"
                    type="button"
                    onClick={() => setSelectedLeaderboard(null)}
                  >
                    BACK TO TOP POSITION
                  </button>
                )}
              </div>
              <div
                className={`leader-visual ${selectedLeaderboard ? 'has-selected-broadcast' : ''}`}
              >
                {selectedLeaderboard?.dropId ? (
                  <div className="leader-portrait leader-video">
                    <DropPlayer dropId={selectedLeaderboard.dropId} />
                  </div>
                ) : selectedLeaderboard ? (
                  <div className="leader-portrait leader-video-placeholder">
                    <Avatar
                      initials={selectedLeaderboard.initials}
                      tone={selectedLeaderboard.tone}
                    />
                    <span className="leader-inline-preview-badge">
                      <Play size={15} fill="currentColor" /> BROADCAST PREVIEW
                    </span>
                  </div>
                ) : (
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
                )}
                <div className="leader-overlay">
                  <strong className="leader-rank">
                    #{selectedLeaderboard?.rank ?? 1}
                  </strong>
                  <span className="leader-category">
                    {selectedLeaderboard?.category ?? 'UNPOPULAR OPINION'}
                  </span>
                  <Money value={selectedLeaderboard?.price ?? '$11,400'} />
                  <div className="leader-metrics">
                    <span>
                      {selectedLeaderboard
                        ? 'LEADERBOARD BROADCAST'
                        : '14,201 VIEWS'}
                    </span>
                    {selectedLeaderboard ? (
                      <span className="leader-selected-status">
                        {selectedLeaderboard.dropId ? 'PLAYING NOW' : 'PREVIEW'}
                      </span>
                    ) : (
                      <Delta value="6 OUTBID" />
                    )}
                  </div>
                  <p>
                    {selectedLeaderboard ? (
                      <>
                        POSITION #{selectedLeaderboard.rank}
                        <br />
                        FROM TODAY&apos;S
                        <br />
                        LEADERBOARD.
                      </>
                    ) : (
                      <>
                        “Your design
                        <br />
                        system is a<br />
                        productivity
                        <br />
                        theatre.”
                      </>
                    )}
                  </p>
                  <div className="leader-person">
                    <strong>
                      {(selectedLeaderboard?.name ?? 'Ananya R.').toUpperCase()}
                    </strong>
                    <span>
                      {selectedLeaderboard?.handle ?? '@ananyabuilds'}
                    </span>
                    <small>
                      {selectedLeaderboard
                        ? "Today's leaderboard"
                        : 'Founder · DesignOps'}
                    </small>
                  </div>
                  {!selectedLeaderboard && (
                    <button
                      className="hero-play"
                      type="button"
                      onClick={() => setVideoPlaying((value) => !value)}
                      aria-label={
                        videoPlaying ? 'Pause broadcast' : 'Play broadcast'
                      }
                    >
                      {videoPlaying ? (
                        'Ⅱ'
                      ) : (
                        <Play size={22} fill="currentColor" />
                      )}
                    </button>
                  )}
                  <Link
                    className="leader-cta"
                    href={`/broadcast?category=${encodeURIComponent(selectedLeaderboard?.category ?? 'UNPOPULAR OPINION')}`}
                    aria-label={
                      selectedLeaderboard
                        ? `Make a broadcast in ${selectedLeaderboard.category}`
                        : 'Take this spot for $11,500'
                    }
                  >
                    <span>
                      {selectedLeaderboard
                        ? 'MAKE A BROADCAST'
                        : 'TAKE THIS SPOT'}
                    </span>
                    <strong>
                      {selectedLeaderboard ? 'OPEN' : '$11,500'}
                    </strong>
                  </Link>
                </div>
              </div>
            </article>

            <div className="dashboard-primary-lower-grid">
              <section className="category-pulse-dashboard dashboard-panel">
                <div className="dashboard-section-head">
                  <span>CATEGORY PULSE</span>
                  <Link href="/categories">
                    VIEW ALL <ArrowUpRight size={11} />
                  </Link>
                </div>
                <div className="category-pulse-list">
                  {categoryPulse.map(({ name, key, bids, positive, path }) => {
                    const Icon = homeCategoryIcons[key];
                    return (
                      <button
                        className="category-pulse-row"
                        key={key}
                        type="button"
                        aria-pressed={activeCategory === key}
                        onClick={() => selectCategory(key)}
                      >
                        <span className="category-pulse-icon">
                          <Icon size={15} strokeWidth={2.2} />
                        </span>
                        <strong>{name}</strong>
                        <PulseSparkline path={path} positive={positive} />
                        <span className="category-pulse-bids category-pulse-total">
                          {bids} BIDS
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <Link
                className="homepage-magazine-dashboard dashboard-panel"
                href="/magazine"
                aria-label={`Open Magazine: yesterday's number one, ${latestIssue.title}`}
              >
                <div className="dashboard-section-head">
                  <span>MAGAZINE</span>
                  <span>
                    OPEN <ArrowUpRight size={11} />
                  </span>
                </div>
                <div className="homepage-magazine-feature">
                  <Image
                    src={latestIssue.image}
                    alt={`${latestIssue.person}, yesterday's number one`}
                    fill
                    sizes="(max-width: 700px) 100vw, (max-width: 1365px) 32vw, 22vw"
                  />
                  <span
                    className="homepage-magazine-wash"
                    aria-hidden="true"
                  />
                  <div className="homepage-magazine-copy">
                    <span>
                      YESTERDAY&apos;S #1 / ISSUE {latestIssue.number}
                    </span>
                    <strong>{latestIssue.title}</strong>
                    <p>{latestIssue.person}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <section className="leaderboard-panel dashboard-panel">
            <div className="dashboard-section-head">
              <span>
                {activeCategory === 'ALL'
                  ? 'GLOBAL LEADERBOARD'
                  : `${activeCategory} LEADERBOARD`}
              </span>
            </div>
            <div className="leaderboard-list">
              {displayedLeaderboard.map((row, index) => {
                const [name, handle, category, price, initials, tone] = row;
                return (
                  <button
                    className="leaderboard-row"
                    type="button"
                    key={name}
                    onClick={() => openLeaderboardBroadcast(row, index)}
                    aria-label={`Watch ${name}'s ${category} broadcast at position ${index + 1}`}
                  >
                    <span className="leaderboard-rank">{index + 1}</span>
                    <Avatar
                      initials={initials}
                      tone={tone}
                      showCrown={index === 0}
                    />
                    <span className="leaderboard-person">
                      <strong>{name}</strong>
                      <small>{handle}</small>
                    </span>
                    <span className="leaderboard-category">{category}</span>
                    <strong className="leaderboard-price">{price}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="dashboard-activity-stack">
            <section className="club-dashboard dashboard-panel">
              <span className="club-crown" aria-hidden="true">
                ♛
              </span>
              <strong>THE BOUGHT CLUB</strong>
              <p>
                Founding members get monthly slots, priority access and a
                permanent badge.
              </p>
              <span className="club-price">
                $— <small>/ MONTH</small>
              </span>
              <Link href="/profile" aria-label="Open your profile to join The Bought Club">
                JOIN THE CLUB
              </Link>
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
                  position on the board.
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
