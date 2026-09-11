'use client';

import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building2,
  CircleHelp,
  Crown,
  DollarSign,
  Eye,
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
import Link from '@/components/site-link';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

import { MarketFooter } from '@/components/market-chrome';
import { MarketTopbar } from '@/components/market-topbar';
import { DropPlayer } from '@/components/drop-player';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useBought } from '@/components/bought-provider';

type Creator = {
  name: string;
  handle: string;
  initials: string;
  duration: string;
  imagePosition: string;
};

type CategoryDefinition = {
  name: string;
  description: string;
  liveCount: string;
  accent: string;
  topBid: number;
  leaderOffset: number;
  leadTitle: string;
  icon: LucideIcon;
};

type CategoryBroadcast = Creator & {
  id: string;
  rank: number;
  title: string;
  price: string;
  change: number;
  views: string;
};

const creators: Creator[] = [
  {
    name: 'Ananya R.',
    handle: '@ananyabuilds',
    initials: 'AR',
    duration: '8:17',
    imagePosition: '25% 15%',
  },
  {
    name: 'Arjun S.',
    handle: '@arjunsays',
    initials: 'AS',
    duration: '12:14',
    imagePosition: '0% 15%',
  },
  {
    name: 'Priya M.',
    handle: '@priyamakes',
    initials: 'PM',
    duration: '10:21',
    imagePosition: '75% 15%',
  },
  {
    name: 'Rahul K.',
    handle: '@rahulbuilds',
    initials: 'RK',
    duration: '6:43',
    imagePosition: '100% 15%',
  },
  {
    name: 'Karan V.',
    handle: '@karanv',
    initials: 'KV',
    duration: '7:43',
    imagePosition: '50% 15%',
  },
  {
    name: 'Maya K.',
    handle: '@mayaknowsthis',
    initials: 'MK',
    duration: '9:12',
    imagePosition: '0% 85%',
  },
  {
    name: 'Dev P.',
    handle: '@devpicks',
    initials: 'DP',
    duration: '8:06',
    imagePosition: '25% 85%',
  },
  {
    name: 'Simran N.',
    handle: '@simrannotes',
    initials: 'SN',
    duration: '6:55',
    imagePosition: '50% 85%',
  },
  {
    name: 'Kabir J.',
    handle: '@kabirj',
    initials: 'KJ',
    duration: '10:14',
    imagePosition: '75% 85%',
  },
  {
    name: 'Aisha T.',
    handle: '@aishatellsit',
    initials: 'AT',
    duration: '7:48',
    imagePosition: '100% 85%',
  },
];

const secondaryTitles = [
  'The number everyone keeps leaving out.',
  'This advice sounds smart. It is not.',
  'What changed after the first 100 customers.',
  'The experiment that cost more than expected.',
  'Nobody tells you this before launch day.',
  'The real timeline, without the victory lap.',
  'We followed the playbook. It still failed.',
  'The uncomfortable decision that fixed it.',
  'What I would never repeat next time.',
  'The receipts behind the headline.',
];

const categories: CategoryDefinition[] = [
  {
    name: 'ALL',
    description: 'The strongest positions across every room.',
    liveCount: '1,155',
    accent: '#ef2b32',
    topBid: 11400,
    leaderOffset: 0,
    leadTitle: 'The sharpest take on the floor right now.',
    icon: Flame,
  },
  {
    name: 'BEEF',
    description: 'Call-outs, disagreements, and public receipts.',
    liveCount: '184',
    accent: '#ff3b45',
    topBid: 9800,
    leaderOffset: 3,
    leadTitle: 'This founder is faking it. Here is proof.',
    icon: MessageCircle,
  },
  {
    name: 'CHAOS',
    description: 'Messy launches, hard pivots, and close calls.',
    liveCount: '28',
    accent: '#f19132',
    topBid: 7600,
    leaderOffset: 5,
    leadTitle: 'Nobody knows what happens after this launch.',
    icon: Zap,
  },
  {
    name: 'UNPOPULAR OPINION',
    description: 'The take nobody wants to say in the room.',
    liveCount: '162',
    accent: '#ef2b32',
    topBid: 11400,
    leaderOffset: 0,
    leadTitle: 'Your design system is productivity theatre.',
    icon: Radio,
  },
  {
    name: 'I WAS WRONG',
    description: 'Honest reversals from people who changed course.',
    liveCount: '141',
    accent: '#7aa7ff',
    topBid: 8700,
    leaderOffset: 6,
    leadTitle: 'I defended this strategy. I was completely wrong.',
    icon: Undo2,
  },
  {
    name: 'THE RANT',
    description: 'Unfiltered arguments with nothing softened.',
    liveCount: '118',
    accent: '#f05a73',
    topBid: 8100,
    leaderOffset: 1,
    leadTitle: 'Stop shipping features nobody asked for.',
    icon: Megaphone,
  },
  {
    name: 'CONFESSIONS',
    description: 'The stories that usually stay off the record.',
    liveCount: '96',
    accent: '#a875ff',
    topBid: 6800,
    leaderOffset: 9,
    leadTitle: 'I nearly killed our best product.',
    icon: MessageCircle,
  },
  {
    name: 'MONEY I SET ON FIRE',
    description: 'Bad bets, expensive lessons, and real numbers.',
    liveCount: '88',
    accent: '#24d27f',
    topBid: 9200,
    leaderOffset: 2,
    leadTitle: 'We burned six months of runway on this.',
    icon: DollarSign,
  },
  {
    name: 'THE PITCH THAT GOT REJECTED',
    description: 'Ideas that lost the room before finding a market.',
    liveCount: '74',
    accent: '#f0c24a',
    topBid: 7400,
    leaderOffset: 4,
    leadTitle: 'They rejected this deck. Then customers showed up.',
    icon: FileText,
  },
  {
    name: 'BUILDING',
    description: 'Show what you are making while it is still messy.',
    liveCount: '69',
    accent: '#2c9cff',
    topBid: 8900,
    leaderOffset: 1,
    leadTitle: 'I built this in 30 days. Here is the real timeline.',
    icon: Building2,
  },
  {
    name: 'THE ASK',
    description: 'Specific questions for people who know the work.',
    liveCount: '61',
    accent: '#b970ff',
    topBid: 6500,
    leaderOffset: 6,
    leadTitle: 'Tell me exactly why this pricing is broken.',
    icon: CircleHelp,
  },
  {
    name: 'HIRING',
    description: 'Teams, talent, interviews, and painful tradeoffs.',
    liveCount: '54',
    accent: '#ff8a3d',
    topBid: 6200,
    leaderOffset: 7,
    leadTitle: 'Your first ten hires should not look like this.',
    icon: Briefcase,
  },
  {
    name: 'AGENCY ROW',
    description: 'The client work everyone complains about privately.',
    liveCount: '43',
    accent: '#49c5b6',
    topBid: 5800,
    leaderOffset: 8,
    leadTitle: 'The retainer model nobody admits is failing.',
    icon: UsersRound,
  },
  {
    name: 'INDIAN D2C',
    description: 'Growth, margins, distribution, and the ground truth.',
    liveCount: '37',
    accent: '#ff9d4d',
    topBid: 7100,
    leaderOffset: 5,
    leadTitle: 'The CAC math behind our biggest mistake.',
    icon: Store,
  },
];

function formatPrice(value: number) {
  return `$${value.toLocaleString('en-US')}`;
}

function makeBroadcasts(
  category: CategoryDefinition,
  categoryIndex: number,
): CategoryBroadcast[] {
  const step = Math.max(280, Math.round(category.topBid / 17));
  const broadcastCount = Number(category.liveCount.replaceAll(',', ''));

  return Array.from({ length: broadcastCount }, (_, index) => {
    const creator = creators[(category.leaderOffset + index) % creators.length];
    const views = Math.max(
      1900,
      14200 - index * 1040 - categoryIndex * 190,
    );
    const changeMagnitude = 2 + ((categoryIndex * 5 + index * 3) % 14);
    const change = (categoryIndex + index) % 4 === 0
      ? -changeMagnitude
      : changeMagnitude;

    return {
      ...creator,
      id: `${category.name}-${index + 1}`,
      rank: index + 1,
      title:
        index === 0
          ? category.leadTitle
          : secondaryTitles[(index + categoryIndex) % secondaryTitles.length],
      price: formatPrice(Math.max(1800, category.topBid - index * step)),
      change,
      views: `${(views / 1000).toFixed(1)}K`,
    };
  });
}

const categoryBroadcasts = categories.map((category, categoryIndex) =>
  makeBroadcasts(category, categoryIndex),
);

const initialBroadcastCount = 10;
const broadcastBatchSize = 20;

function VideoThumbnail({
  broadcast,
  prominent = false,
  shouldLoad = false,
}: {
  broadcast: CategoryBroadcast;
  prominent?: boolean;
  shouldLoad?: boolean;
}) {
  const style = shouldLoad
    ? {
        backgroundImage: 'url(/leaderboard-portraits.png)',
        backgroundPosition: broadcast.imagePosition,
        backgroundSize: '500% auto',
      }
    : undefined;

  return (
    <span
      className={`category-video-thumbnail ${prominent ? 'is-prominent' : ''} ${shouldLoad ? 'is-loaded' : 'is-deferred'}`}
      style={style}
      aria-hidden="true"
    >
      {!shouldLoad && (
        <span className="category-thumbnail-deferred">
          <ProfileAvatar
            initials={broadcast.initials}
            imageSrc="/leaderboard-portraits.png"
            imagePosition={broadcast.imagePosition}
            className="category-deferred-avatar"
          />
        </span>
      )}
    </span>
  );
}

function BroadcastVideoCard({
  broadcast,
  category,
  playingId,
  onPlay,
  loadThumbnail,
  allowPlayback,
  dropId,
}: {
  broadcast: CategoryBroadcast;
  category: CategoryDefinition;
  playingId: string | null;
  onPlay: (id: string) => void;
  loadThumbnail: boolean;
  allowPlayback: boolean;
  dropId: string | null;
}) {
  const isTopRank = broadcast.rank === 1;
  const isPlaying = playingId === broadcast.id;

  return (
    <section
      className={`category-lead-card category-broadcast-video ${isPlaying ? 'is-playing' : ''}`}
    >
      <VideoThumbnail
        broadcast={broadcast}
        prominent
        shouldLoad={loadThumbnail}
      />
      {isPlaying && dropId && (
        <div className="category-on-demand-player">
          <DropPlayer dropId={dropId} />
        </div>
      )}
      <span className="category-lead-shade" aria-hidden="true" />
      <span className="category-lead-rank">
        {isTopRank && (
          <Crown
            size={22}
            strokeWidth={2}
            fill="currentColor"
            aria-hidden="true"
          />
        )}
        <b>#{broadcast.rank}</b>
        <em>
          <i /> LIVE
        </em>
      </span>
      <div className="category-lead-copy">
        <span>{category.name}</span>
        <h2>&ldquo;{broadcast.title}&rdquo;</h2>
        <strong>{broadcast.name}</strong>
        <small>{broadcast.handle}</small>
      </div>
      <div className="category-lead-value">
        <strong>{broadcast.price}</strong>
        <span>
          <Eye size={12} /> {broadcast.views} views
        </span>
      </div>
      {allowPlayback && (
        <button
          className="category-lead-play"
          type="button"
          disabled={!dropId}
          onClick={() => {
            if (dropId) onPlay(broadcast.id);
          }}
          aria-label={
            dropId
              ? `${isPlaying ? 'Stop' : 'Play'} ${broadcast.name}'s broadcast at rank ${broadcast.rank}`
              : `${broadcast.name}'s broadcast is not ready to play`
          }
        >
          {isPlaying ? 'Ⅱ' : <Play size={22} fill="currentColor" />}
        </button>
      )}
    </section>
  );
}

const CategoryPanel = memo(function CategoryPanel({
  category,
  categoryIndex,
  position,
  playingId,
  onPlay,
  visibleCount,
  onLoadMore,
  dropIdsByRank,
}: {
  category: CategoryDefinition;
  categoryIndex: number;
  position: 'previous' | 'active' | 'next';
  playingId: string | null;
  onPlay: (id: string) => void;
  visibleCount: number;
  onLoadMore: (categoryName: string) => void;
  dropIdsByRank: Record<number, string>;
}) {
  const Icon = category.icon;
  const broadcasts = categoryBroadcasts[categoryIndex];
  const leader = broadcasts[0];
  const categoryHref = `/categories?category=${encodeURIComponent(category.name)}`;
  const loadedCount = Math.min(visibleCount, broadcasts.length);
  const listEnd =
    position === 'active' ? loadedCount : Math.min(10, broadcasts.length);
  const hasMore = loadedCount < broadcasts.length;
  const loadMarkerRef = useRef<HTMLDivElement>(null);
  const categoryStyle = {
    '--category-accent': category.accent,
  } as CSSProperties;

  useEffect(() => {
    if (position !== 'active' || !hasMore) return;

    const marker = loadMarkerRef.current;
    if (!marker) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore(category.name);
      },
      { rootMargin: '0px' },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [category.name, hasMore, loadedCount, onLoadMore, position]);

  return (
    <article
      className={`category-market-panel is-${position}`}
      style={categoryStyle}
      aria-label={`${category.name} category, ${position === 'active' ? 'selected' : `${position} preview`}`}
    >
      <div className="category-market-panel-inner">
        <header className="category-market-header">
          <span className="category-market-icon" aria-hidden="true">
            <Icon
              size={position === 'active' ? 28 : 23}
              strokeWidth={2.15}
            />
          </span>
          <span className="category-market-heading">
            <strong>{category.name}</strong>
            <small>{category.description}</small>
          </span>
          <span className="category-market-live">
            <i /> {category.liveCount} live drops
          </span>
        </header>

        <BroadcastVideoCard
          broadcast={leader}
          category={category}
          playingId={playingId}
          onPlay={onPlay}
          loadThumbnail={position === 'active'}
          allowPlayback={position === 'active'}
          dropId={dropIdsByRank[leader.rank] ?? null}
        />

        <div className="category-market-list-head">
          <strong>
            {category.name === 'ALL'
              ? 'ALL BROADCASTS'
              : `${category.name} BROADCASTS`}
          </strong>
          <span className="category-market-list-actions">
            <span>
              {position === 'active'
                ? `${loadedCount} OF ${broadcasts.length.toLocaleString('en-US')}`
                : `${broadcasts.length.toLocaleString('en-US')} LIVE`}
            </span>
            <Link href={categoryHref}>VIEW ALL</Link>
          </span>
        </div>

        <div
          className={`category-market-list ${position === 'active' ? 'is-video-feed' : ''}`}
        >
          {position === 'active'
            ? broadcasts.slice(1, listEnd).map((broadcast) => (
                <BroadcastVideoCard
                  key={broadcast.id}
                  broadcast={broadcast}
                  category={category}
                  playingId={playingId}
                  onPlay={onPlay}
                  loadThumbnail
                  allowPlayback
                  dropId={dropIdsByRank[broadcast.rank] ?? null}
                />
              ))
            : broadcasts.slice(1, listEnd).map((broadcast) => (
                <div className="category-market-row" key={broadcast.id}>
                  <span className="category-market-rank">{broadcast.rank}</span>
                  <ProfileAvatar
                    initials={broadcast.initials}
                    imageSrc="/leaderboard-portraits.png"
                    imagePosition={broadcast.imagePosition}
                    className="category-market-avatar"
                    alt={broadcast.name}
                  />
                  <span className="category-market-row-copy">
                    <strong>{broadcast.title}</strong>
                    <small>
                      {broadcast.name} · {broadcast.handle}
                    </small>
                  </span>
                  <span className="category-market-row-value">
                    <strong>{broadcast.price}</strong>
                    <span className="category-market-row-meta">
                      <span
                        className={
                          broadcast.change > 0 ? 'is-up' : 'is-down'
                        }
                      >
                        {broadcast.change > 0 ? (
                          <ArrowUp size={10} strokeWidth={2.4} />
                        ) : (
                          <ArrowDown size={10} strokeWidth={2.4} />
                        )}
                        {Math.abs(broadcast.change)}%
                      </span>
                      <span>
                        <Eye size={10} /> {broadcast.views}
                      </span>
                    </span>
                  </span>
                </div>
              ))}
        </div>

        {position === 'active' && hasMore && (
          <div
            ref={loadMarkerRef}
            className="category-market-view-more"
            aria-hidden="true"
          />
        )}
      </div>
    </article>
  );
});

CategoryPanel.displayName = 'CategoryPanel';

export default function CategoriesPage() {
  const { entries } = useBought();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    {},
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef(0);
  const scrollFrame = useRef<number | null>(null);

  const previousCategory =
    activeIndex > 0 ? categories[activeIndex - 1] : null;
  const nextCategory =
    activeIndex < categories.length - 1 ? categories[activeIndex + 1] : null;

  const scrollToCategory = useCallback(
    (index: number, behavior: ScrollBehavior = 'auto') => {
      const stage = stageRef.current;
      const slot = slotRefs.current[index];
      if (!stage || !slot) return;

      const left =
        slot.offsetLeft - (stage.clientWidth - slot.offsetWidth) / 2;
      stage.scrollTo({ left, behavior });
    },
    [],
  );

  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search)
      .get('category')
      ?.toUpperCase();
    const requestedIndex = categories.findIndex(
      (category) => category.name === requestedCategory,
    );
    if (requestedIndex <= 0) return;
    const frame = window.requestAnimationFrame(() => {
      activeIndexRef.current = requestedIndex;
      setActiveIndex(requestedIndex);
      scrollToCategory(requestedIndex, 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToCategory]);

  useEffect(() => {
    tabRefs.current[activeIndex]?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex]);

  useEffect(
    () => () => {
      if (scrollFrame.current !== null)
        window.cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );

  function selectCategory(nextIndex: number) {
    const currentIndex = activeIndexRef.current;
    if (
      nextIndex < 0 ||
      nextIndex >= categories.length ||
      nextIndex === currentIndex
    )
      return;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    setPlayingId(null);
    scrollToCategory(nextIndex, 'auto');
  }

  const toggleBroadcast = useCallback((id: string) => {
    setPlayingId((current) => (current === id ? null : id));
  }, []);

  const loadMoreBroadcasts = useCallback(
    (categoryName: string) => {
      const categoryIndex = categories.findIndex(
        (category) => category.name === categoryName,
      );
      if (categoryIndex < 0) return;

      setVisibleCounts((current) => ({
        ...current,
        [categoryName]: Math.min(
          (current[categoryName] ?? initialBroadcastCount) +
            broadcastBatchSize,
          categoryBroadcasts[categoryIndex].length,
        ),
      }));
    },
    [],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectCategory(activeIndexRef.current - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectCategory(activeIndexRef.current + 1);
    }
  }

  function handleScroll() {
    if (scrollFrame.current !== null) return;

    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      const stage = stageRef.current;
      if (!stage) return;

      const viewportCenter = stage.scrollLeft + stage.clientWidth / 2;
      let nearestIndex = activeIndexRef.current;
      let nearestDistance = Number.POSITIVE_INFINITY;

      slotRefs.current.forEach((slot, index) => {
        if (!slot) return;
        const slotCenter = slot.offsetLeft + slot.offsetWidth / 2;
        const distance = Math.abs(slotCenter - viewportCenter);
        if (distance >= nearestDistance) return;
        nearestIndex = index;
        nearestDistance = distance;
      });

      if (nearestIndex === activeIndexRef.current) return;
      activeIndexRef.current = nearestIndex;
      setActiveIndex(nearestIndex);
      setPlayingId(null);
    });
  }

  return (
    <main className="market-shell dashboard-shell category-carousel-page">
      <div className="scanlines" aria-hidden="true" />
      <MarketTopbar active="categories" />

      <div className="dashboard-wrap category-carousel-filter-wrap">
        <section
          className="homepage-category-selector dashboard-panel"
          aria-label="Choose a market category"
        >
          <div className="dashboard-section-head">
            <span>CATEGORIES</span>
            <Link href="/categories?category=ALL" onClick={() => selectCategory(0)}>
              VIEW ALL
            </Link>
          </div>
          <div
            className="homepage-category-list"
            role="tablist"
            aria-label="Market categories"
          >
            {categories.map((category, index) => {
              const Icon = category.icon;
              const isTrending = category.name === 'BEEF';
              return (
                <button
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  className={`homepage-category-option ${activeIndex === index ? 'is-active' : ''} ${isTrending ? 'is-trending' : ''}`}
                  key={category.name}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === index}
                  aria-label={`${category.name}, ${category.liveCount} bids${isTrending ? ', trending today' : ''}`}
                  onClick={() => selectCategory(index)}
                  onKeyDown={handleKeyDown}
                >
                  <Icon
                    className="homepage-category-icon"
                    size={13}
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                  <strong>{category.name}</strong>
                  <span>{category.liveCount} bids</span>
                  {isTrending && (
                    <span className="homepage-category-trending">
                      <Flame size={11} /> TRENDING TODAY
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="dashboard-wrap category-carousel-wrap">
        <section
          ref={stageRef}
          className="category-carousel-stage"
          aria-label="Category leaderboard carousel"
          aria-roledescription="carousel"
          aria-live="polite"
          onScroll={handleScroll}
        >
          {categories.map((category, index) => {
            const position =
              index === activeIndex
                ? 'active'
                : index < activeIndex
                  ? 'previous'
                  : 'next';

            return (
              <div
                ref={(element) => {
                  slotRefs.current[index] = element;
                }}
                className={`category-carousel-slot is-${position}`}
                key={category.name}
              >
                <CategoryPanel
                  category={category}
                  categoryIndex={index}
                  position={position}
                  playingId={playingId}
                  onPlay={toggleBroadcast}
                  visibleCount={
                    visibleCounts[category.name] ?? initialBroadcastCount
                  }
                  onLoadMore={loadMoreBroadcasts}
                  dropIdsByRank={Object.fromEntries(
                    entries
                      .filter(
                        (entry) =>
                          category.name === 'ALL' ||
                          entry.category.toUpperCase() === category.name,
                      )
                      .map((entry) => [entry.position, entry.drop_id]),
                  )}
                />
              </div>
            );
          })}
        </section>

        <div className="category-carousel-footer-nav" aria-hidden="true">
          <span>{previousCategory ? `← ${previousCategory.name}` : ''}</span>
          <div>
            {categories.map((category, index) => (
              <i
                className={index === activeIndex ? 'is-active' : ''}
                key={category.name}
              />
            ))}
          </div>
          <span>{nextCategory ? `${nextCategory.name} →` : ''}</span>
        </div>

        <MarketFooter />
      </div>
    </main>
  );
}
