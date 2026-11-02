'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/site-link';

import {
  MarketFooter,
  TodayBar,
} from '@/components/market-chrome';
import { useBought } from '@/components/bought-provider';
import {
  BroadcastVideoCard,
  type CategoryBroadcast,
} from '@/app/categories/page';
import { money } from '@/lib/drop-domain';

import './today.css';

type LeaderboardRow = [string, string, string, string, string, string];

const leaderboard: LeaderboardRow[] = [
  ['Ananya Rao', '@ananyabuilds', 'UNPOPULAR OPINION', '$11,400', 'AR', 'coral'],
  ['Arjun Sharma', '@arjunsays', 'BUILDING', '$8,900', 'AS', 'green'],
  [
    'Priya Mehta',
    '@priyamakes',
    'MONEY I SET ON FIRE',
    '$6,200',
    'PM',
    'orange',
  ],
  ['Rahul Kapoor', '@rahulbuilds', 'PRODUCT LAUNCH', '$6,200', 'RK', 'blue'],
  ['Karan Verma', '@karanv', 'UNPOPULAR OPINION', '$4,800', 'KV', 'purple'],
  ['Maya Khanna', '@mayaknowsthis', 'I WAS WRONG', '$4,200', 'MK', 'green'],
  ['Dev Patel', '@devpicks', 'THE PITCH THAT GOT REJECTED', '$3,900', 'DP', 'blue'],
  [
    'Simran Nair',
    '@simrannotes',
    'MONEY I SET ON FIRE',
    '$3,600',
    'SN',
    'orange',
  ],
  ['Kabir Joshi', '@kabirj', 'BUILDING', '$3,200', 'KJ', 'coral'],
  ['Aisha Thomas', '@aishatellsit', 'CONFESSIONS', '$2,900', 'AT', 'purple'],
];

const leaderboardMovementSeeds = [
  1_340, 920, -640, 480, 360, -280, 220, -180, 140, -100,
] as const;
function getLeaderboardMovement(index: number, pulse: number) {
  const seed =
    leaderboardMovementSeeds[index % leaderboardMovementSeeds.length];
  if (pulse === 0) return seed;

  const direction = (pulse + index) % 2 === 0 ? 1 : -1;
  const scale = 0.72 + ((pulse + index) % 5) * 0.08;
  return direction * Math.max(120, Math.round(Math.abs(seed) * scale));
}

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

const leaderboardPortraitPositions: Record<string, string> = {
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
};

function getTakePrice(price: string) {
  const amount = Number(price.replace(/[^0-9]/g, ''));
  return Number.isFinite(amount)
    ? `$${(amount + 100).toLocaleString('en-US')}`
    : price;
}

const globalLeadBroadcast: CategoryBroadcast = {
  id: 'GLOBAL-LEADER-1',
  name: 'Ananya Rao',
  handle: '@ananyabuilds',
  initials: 'AR',
  duration: '8:17',
  imagePosition: leaderboardPortraitPositions.AR,
  socialPlatform: 'LinkedIn',
  profileType: 'Creator',
  location: 'Bengaluru, India',
  categoryName: 'UNPOPULAR OPINION',
  rank: 1,
  title: 'Your design system is productivity theatre.',
  price: '$11,400',
  change: -6,
  views: 14201,
  shares: 327,
  outbidCount: 6,
  takePrice: '$11,500',
  topRankedAt: 'now',
};

const homeCategories = [
  ['ALL', '1,155'],
  ['UNPOPULAR OPINION', '162'],
  ['I WAS WRONG', '141'],
  ['CONFESSIONS', '96'],
  ['MONEY I SET ON FIRE', '88'],
  ['THE PITCH THAT GOT REJECTED', '74'],
  ['BUILDING', '69'],
  ['PRODUCT LAUNCH', '42'],
] as const;

const categoryLeaderBidCaps: Record<string, number> = {
  'UNPOPULAR OPINION': 11_400,
  'I WAS WRONG': 8_700,
  CONFESSIONS: 6_800,
  'MONEY I SET ON FIRE': 9_200,
  'THE PITCH THAT GOT REJECTED': 7_400,
  BUILDING: 8_900,
  'PRODUCT LAUNCH': 7_800,
};

const categoryLeaderOffsets: Record<string, number> = {
  'UNPOPULAR OPINION': 0,
  'I WAS WRONG': 6,
  CONFESSIONS: 9,
  'MONEY I SET ON FIRE': 2,
  'THE PITCH THAT GOT REJECTED': 4,
  BUILDING: 1,
  'PRODUCT LAUNCH': 3,
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
  { name: 'Unpopular Opinion', key: 'UNPOPULAR OPINION', bids: '1,420' },
  { name: 'Money', key: 'MONEY I SET ON FIRE', bids: '980' },
  { name: 'Building', key: 'BUILDING', bids: '760' },
  { name: 'Product Launch', key: 'PRODUCT LAUNCH', bids: '420' },
] as const;

const portraitPositions: Record<string, string> = {
  ...leaderboardPortraitPositions,
  SJ: '25% 0%',
  EC: '50% 0%',
};

function Portrait({
  initials,
  className = '',
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={`today-portrait ${className}`}
      style={{ backgroundPosition: portraitPositions[initials] ?? '50% 50%' }}
      aria-hidden="true"
    />
  );
}

type LeaderboardMarketState = 'live' | 'exposure' | 'syncing';

function BoardMovement({
  state,
  index,
  pulse,
}: {
  state: LeaderboardMarketState;
  index: number;
  pulse: number;
}) {
  if (state !== 'live') {
    return (
      <small className="today-board-move is-flat">
        {state === 'exposure' ? 'Exposure period' : 'Syncing'}
      </small>
    );
  }

  const movement = getLeaderboardMovement(index, pulse);
  const down = movement < 0;
  const amount = `${down ? '-' : '+'}$${Math.abs(movement).toLocaleString('en-US')}`;

  return (
    <small
      className={`today-board-move ${down ? 'is-down' : 'is-up'}`}
      aria-label={`${amount} since the last update`}
    >
      {down ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
      {amount}
    </small>
  );
}

function useEditionDate() {
  const [date, setDate] = useState('');
  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setDate(
        new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date()),
      ),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return date;
}


export default function Home() {
  const { entries, market, marketFresh } = useBought();
  const [playingBroadcastId, setPlayingBroadcastId] = useState<string | null>(
    null,
  );
  const [selectedLeaderboard, setSelectedLeaderboard] =
    useState<LeaderboardSelection | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [leaderboardPulse, setLeaderboardPulse] = useState(0);
  const editionDate = useEditionDate();
  const moreEntries = entries.slice(1, 7);
  const moreKey = moreEntries.map((entry) => entry.drop_id).join(',');
  const [moreThumbnails, setMoreThumbnails] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    const ids = moreKey ? moreKey.split(',') : [];
    if (ids.length === 0) return;
    let cancelled = false;
    const load = () => {
      void Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/bought/media/${id}`);
            if (!response.ok) return null;
            const media = (await response.json()) as { thumbnail?: string };
            return media.thumbnail ? ([id, media.thumbnail] as const) : null;
          } catch {
            return null;
          }
        }),
      ).then((pairs) => {
        if (cancelled) return;
        setMoreThumbnails(
          Object.fromEntries(pairs.filter((pair) => pair !== null)),
        );
      });
    };
    load();
    // Signed thumbnail links last 10 minutes.
    const refresh = window.setInterval(load, 8 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [moreKey]);
  const leaderboardAuctionActive = marketFresh && market?.phase === 'bidding';
  const leaderboardMarketState: LeaderboardMarketState =
    leaderboardAuctionActive
      ? 'live'
      : marketFresh && market?.phase === 'exposure'
        ? 'exposure'
        : 'syncing';
  const displayedLeaderboard =
    categoryLeaderboards[activeCategory] ?? categoryLeaderboards.ALL;
  const leadBroadcast: CategoryBroadcast = selectedLeaderboard
    ? {
        ...globalLeadBroadcast,
        id: `GLOBAL-LEADER-${selectedLeaderboard.rank}-${selectedLeaderboard.category}`,
        name: selectedLeaderboard.name,
        handle: selectedLeaderboard.handle,
        initials: selectedLeaderboard.initials,
        categoryName: selectedLeaderboard.category,
        rank: selectedLeaderboard.rank,
        price: selectedLeaderboard.price,
        takePrice: getTakePrice(selectedLeaderboard.price),
        imagePosition:
          leaderboardPortraitPositions[selectedLeaderboard.initials] ??
          globalLeadBroadcast.imagePosition,
        title: `Position #${selectedLeaderboard.rank} from today's leaderboard.`,
        views: Math.max(1200, 14201 - selectedLeaderboard.rank * 640),
        shares: Math.max(80, 327 - selectedLeaderboard.rank * 18),
        outbidCount: Math.max(1, 7 - selectedLeaderboard.rank),
        topRankedAt: 'now',
      }
    : globalLeadBroadcast;

  useEffect(() => {
    if (!leaderboardAuctionActive) return;

    const timer = window.setInterval(() => {
      setLeaderboardPulse((current) => current + 1);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [leaderboardAuctionActive]);

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
    setPlayingBroadcastId(null);
  }

  function submitReview(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewText.trim()) return;
    setReviewSent(true);
    setReviewText('');
  }

  return (
    <main className="market-shell dashboard-shell today-home">

      <div className="today-page">
        <header className="today-masthead">
          <div className="today-dateline">
            <span>{editionDate || "Today's edition"}</span>
            <span>The Bought Spotlight</span>
            <span>Global edition</span>
          </div>
          <div className="today-title">
            <h1>
              Today&rsquo;s Spotlight<span aria-hidden="true">.</span>
            </h1>
            <p>
              Bid for a place in the Bought Spotlight, the broadcast slot
              inside our daily newspaper. The highest bid holds the top
              position.
            </p>
          </div>
        </header>

        <TodayBar />

        <div className="today-grid">
          <div className="today-main">
            <section className="today-lead" aria-label="The Lead Spotlight">
              <div className="today-label">
                <span>
                  {selectedLeaderboard
                    ? `Position #${selectedLeaderboard.rank} on the board`
                    : 'The Lead Spotlight'}
                  <i aria-hidden="true" />
                </span>
                {selectedLeaderboard ? (
                  <button
                    type="button"
                    onClick={() => setSelectedLeaderboard(null)}
                  >
                    Back to the lead
                  </button>
                ) : (
                  <span className="today-label-note">Live now</span>
                )}
              </div>
              <div className="today-plate">
                <BroadcastVideoCard
                  key={leadBroadcast.id}
                  broadcast={leadBroadcast}
                  playingId={playingBroadcastId}
                  onPlay={(id) =>
                    setPlayingBroadcastId((current) =>
                      current === id ? null : id,
                    )
                  }
                  loadThumbnail
                  dropId={
                    selectedLeaderboard
                      ? selectedLeaderboard.dropId
                      : (entries[0]?.drop_id ?? null)
                  }
                  autoPreview={
                    !selectedLeaderboard || selectedLeaderboard.rank === 1
                  }
                />
              </div>
            </section>

            <div className="today-lower">
              <section className="today-sections" aria-label="Sections">
                <div className="today-label">
                  <span>Sections</span>
                  <Link href="/categories">All sections</Link>
                </div>
                <div className="today-section-list">
                  {categoryPulse.map(({ name, key, bids }) => (
                    <button
                      className="today-section-row"
                      key={key}
                      type="button"
                      aria-pressed={activeCategory === key}
                      onClick={() => selectCategory(key)}
                    >
                      <strong>{name}</strong>
                      <span className="today-leader" aria-hidden="true" />
                      <small>{bids} entries</small>
                    </button>
                  ))}
                </div>
                {activeCategory !== 'ALL' && (
                  <button
                    className="today-section-reset"
                    type="button"
                    onClick={() => selectCategory('ALL')}
                  >
                    Show every section
                  </button>
                )}
              </section>

              <Link
                className="today-paper"
                href="/newspaper"
                aria-label="Open today's newspaper"
              >
                <div className="today-label">
                  <span>Today&rsquo;s paper</span>
                  <span className="today-label-note">
                    Read <ArrowUpRight size={11} />
                  </span>
                </div>
                <div className="today-paper-body">
                  <div className="today-paper-image">
                    <Image
                      src="/newspaper/assets/swipe-rocket.jpg"
                      alt=""
                      fill
                      sizes="(max-width: 700px) 40vw, 160px"
                    />
                  </div>
                  <div className="today-paper-copy">
                    <span className="today-kicker">Today&rsquo;s issue · 50 stories</span>
                    <h3>The daily newspaper</h3>
                    <p>
                      Tech, AI, business and startups, with the Spotlight
                      broadcasts placed between the stories.
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <aside className="today-rail">
            <section className="today-board" aria-label="Spotlight Board">
              <div className="today-label">
                <span>
                  {activeCategory === 'ALL'
                    ? 'The Spotlight Board'
                    : `${activeCategory} board`}
                </span>
                <span
                  className={`today-state is-${leaderboardMarketState}`}
                >
                  <i aria-hidden="true" />
                  {leaderboardMarketState === 'live'
                    ? 'Auction live'
                    : leaderboardMarketState === 'exposure'
                      ? 'Exposure period'
                      : 'Syncing'}
                </span>
              </div>
              <ol className="today-board-list">
                {displayedLeaderboard.map((row, index) => {
                  const [name, , category, price, initials] = row;
                  const selected = selectedLeaderboard?.rank === index + 1;
                  return (
                    <li key={name}>
                      <button
                        className="today-board-row"
                        type="button"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => openLeaderboardBroadcast(row, index)}
                        aria-label={`Watch ${name}'s ${category} broadcast at position ${index + 1}`}
                      >
                        <span className="today-board-rank">{index + 1}</span>
                        <Portrait initials={initials} />
                        <span className="today-board-person">
                          <strong>{name}</strong>
                          <small>
                            {index === 0 && <b>Lead · </b>}
                            {category.toLowerCase()}
                          </small>
                        </span>
                        <span className="today-board-bid">
                          <strong>{price}</strong>
                          <BoardMovement
                            state={leaderboardMarketState}
                            index={index}
                            pulse={leaderboardPulse}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="today-club" aria-label="The Bought Club">
              <span className="today-kicker">Membership</span>
              <h3>The Bought Club</h3>
              <p>
                Founding members get monthly slots, priority access and a
                permanent badge.
              </p>
              <div className="today-club-foot">
                <span>
                  $&mdash; <small>/ month</small>
                </span>
                <span className="today-club-soon">Coming soon</span>
              </div>
            </section>

            <section className="today-letter" aria-label="From the readers">
              <span className="today-kicker">From the readers</span>
              <blockquote>
                &ldquo;This platform cuts through the fake noise. Love it.&rdquo;
              </blockquote>
              <cite>Arnav, Indie Hacker</cite>
              <button
                type="button"
                onClick={() => {
                  setReviewSent(false);
                  setReviewOpen(true);
                }}
              >
                Write a review
              </button>
            </section>
          </aside>
        </div>

        {moreEntries.length > 0 && (
          <section
            className="today-more"
            aria-label="More from today's Spotlight"
          >
            <div className="today-label">
              <span>More from today&rsquo;s Spotlight</span>
              <Link href="/categories">View all</Link>
            </div>
            <div className="today-more-row">
              {moreEntries.map((entry) => (
                <article className="today-more-card" key={entry.drop_id}>
                  <div className="today-more-thumb">
                    {moreThumbnails[entry.drop_id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="today-more-photo"
                        src={moreThumbnails[entry.drop_id]}
                        alt=""
                      />
                    ) : (
                      <span className="today-more-photo" aria-hidden="true" />
                    )}
                  </div>
                  <span className="today-kicker is-red">
                    {entry.category.toLowerCase()}
                  </span>
                  <h3>{entry.title}</h3>
                  <p>
                    {entry.amount_minor > 0 ? (
                      <>
                        Bid <strong>{money(entry.amount_minor)}</strong>
                      </>
                    ) : (
                      <strong>Free entry</strong>
                    )}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

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

        <MarketFooter />
      </div>
    </main>
  );
}
