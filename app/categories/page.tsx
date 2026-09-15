'use client';

import {
  ArrowUp,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  CircleHelp,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Radio,
  Share2,
  Store,
  Undo2,
  UsersRound,
  Volume2,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import Image from 'next/image';

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
  socialPlatform: string;
  profileType: string;
  location: string;
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
  views: number;
  shares: number;
  outbidCount: number;
  takePrice: string;
};

const creators: Creator[] = [
  {
    name: 'Ananya R.',
    handle: '@ananyabuilds',
    initials: 'AR',
    duration: '8:17',
    imagePosition: '25% 15%',
    socialPlatform: 'LinkedIn',
    profileType: 'Creator',
    location: 'Bengaluru, India',
  },
  {
    name: 'Arjun S.',
    handle: '@arjunsays',
    initials: 'AS',
    duration: '12:14',
    imagePosition: '0% 15%',
    socialPlatform: 'X',
    profileType: 'Individual',
    location: 'Mumbai, India',
  },
  {
    name: 'Priya M.',
    handle: '@priyamakes',
    initials: 'PM',
    duration: '10:21',
    imagePosition: '75% 15%',
    socialPlatform: 'Instagram',
    profileType: 'Creator',
    location: 'New Delhi, India',
  },
  {
    name: 'Rahul K.',
    handle: '@rahulbuilds',
    initials: 'RK',
    duration: '6:43',
    imagePosition: '100% 15%',
    socialPlatform: 'YouTube',
    profileType: 'Company',
    location: 'Hyderabad, India',
  },
  {
    name: 'Karan V.',
    handle: '@karanv',
    initials: 'KV',
    duration: '7:43',
    imagePosition: '50% 15%',
    socialPlatform: 'LinkedIn',
    profileType: 'Investor',
    location: 'London, United Kingdom',
  },
  {
    name: 'Maya K.',
    handle: '@mayaknowsthis',
    initials: 'MK',
    duration: '9:12',
    imagePosition: '0% 85%',
    socialPlatform: 'TikTok',
    profileType: 'Creator',
    location: 'Singapore',
  },
  {
    name: 'Dev P.',
    handle: '@devpicks',
    initials: 'DP',
    duration: '8:06',
    imagePosition: '25% 85%',
    socialPlatform: 'X',
    profileType: 'Creator',
    location: 'New York, United States',
  },
  {
    name: 'Simran N.',
    handle: '@simrannotes',
    initials: 'SN',
    duration: '6:55',
    imagePosition: '50% 85%',
    socialPlatform: 'Instagram',
    profileType: 'Individual',
    location: 'Toronto, Canada',
  },
  {
    name: 'Kabir J.',
    handle: '@kabirj',
    initials: 'KJ',
    duration: '10:14',
    imagePosition: '75% 85%',
    socialPlatform: 'LinkedIn',
    profileType: 'Company',
    location: 'Bengaluru, India',
  },
  {
    name: 'Aisha T.',
    handle: '@aishatellsit',
    initials: 'AT',
    duration: '7:48',
    imagePosition: '100% 85%',
    socialPlatform: 'YouTube',
    profileType: 'Creator',
    location: 'Dubai, United Arab Emirates',
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
    const views = Math.max(1900, 14000 - index * 1040 - categoryIndex * 190);
    const changeMagnitude = 2 + ((categoryIndex * 5 + index * 3) % 14);
    const change =
      (categoryIndex + index) % 4 === 0 ? -changeMagnitude : changeMagnitude;
    const bidValue = Math.max(1800, category.topBid - index * step);
    const shares = Math.max(18, 327 - index * 23 - categoryIndex * 11);
    const outbidCount = Math.max(
      0,
      3 + (categoryIndex % 3) - Math.min(index, 4),
    );

    return {
      ...creator,
      id: `${category.name}-${index + 1}`,
      rank: index + 1,
      title:
        index === 0
          ? category.leadTitle
          : secondaryTitles[(index + categoryIndex) % secondaryTitles.length],
      price: formatPrice(bidValue),
      change,
      views,
      shares,
      outbidCount,
      takePrice: formatPrice(bidValue + 100),
    };
  });
}

const categoryBroadcasts = categories.map((category, categoryIndex) =>
  makeBroadcasts(category, categoryIndex),
);

const initialBroadcastCount = 10;
const broadcastBatchSize = 10;

function VideoThumbnail({
  broadcast,
  prominent = false,
  shouldLoad = false,
}: {
  broadcast: CategoryBroadcast;
  prominent?: boolean;
  shouldLoad?: boolean;
}) {
  const prominentImage = prominent ? '/category-feature-poster.jpg' : null;
  const style = shouldLoad
    ? prominentImage
      ? undefined
      : {
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
      {shouldLoad && prominentImage && (
        <Image
          className="category-thumbnail-image"
          src={prominentImage}
          alt=""
          fill
          sizes="(max-width: 680px) 100vw, 48vw"
        />
      )}
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
  dropId,
  useSharedDemoVideo = false,
}: {
  broadcast: CategoryBroadcast;
  category: CategoryDefinition;
  playingId: string | null;
  onPlay: (id: string) => void;
  loadThumbnail: boolean;
  dropId: string | null;
  useSharedDemoVideo?: boolean;
}) {
  const isPlaying = playingId === broadcast.id;
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasLocalDemo = useSharedDemoVideo || broadcast.rank === 1;
  const canPlay = hasLocalDemo || Boolean(dropId);

  useEffect(() => {
    if (!hasLocalDemo || !videoRef.current) return;

    if (isPlaying) {
      void videoRef.current.play();
      return;
    }

    videoRef.current.pause();
  }, [hasLocalDemo, isPlaying]);

  return (
    <section
      className={`category-lead-card category-broadcast-video ${isPlaying ? 'is-playing' : ''}`}
    >
      <div className="category-lead-media">
        <VideoThumbnail
          broadcast={broadcast}
          prominent
          shouldLoad={loadThumbnail}
        />
        {hasLocalDemo && (
          <div className="category-on-demand-player category-local-player">
            <video
              ref={videoRef}
              src="/video/category-feature.mp4"
              poster="/category-feature-poster.jpg"
              muted={isMuted}
              playsInline
              preload="metadata"
              aria-label={`${broadcast.name}'s one-minute featured broadcast`}
              onEnded={() => onPlay(broadcast.id)}
            >
              <track
                kind="captions"
                src="/video/category-feature.vtt"
                srcLang="en"
                label="English"
                default
              />
            </video>
          </div>
        )}
        {isPlaying && !hasLocalDemo && dropId && (
          <div className="category-on-demand-player">
            <DropPlayer dropId={dropId} />
          </div>
        )}
        <span className="category-lead-shade" aria-hidden="true" />
        <div
          className={`category-stage-status ${isPlaying ? 'is-visible' : ''}`}
          aria-hidden={!isPlaying}
        >
          <i aria-hidden="true" />
          <span>
            <strong>ON STAGE</strong>
            <small>LIVE TO THE WORLD</small>
          </span>
        </div>
        <div className="category-lead-media-actions">
          <button
            className={`category-lead-control category-lead-watchlist ${isWatchlisted ? 'is-saved' : ''}`}
            type="button"
            aria-pressed={isWatchlisted}
            aria-label={`${isWatchlisted ? 'Remove' : 'Add'} ${broadcast.name}'s broadcast ${isWatchlisted ? 'from' : 'to'} your watchlist`}
            onClick={() => setIsWatchlisted((saved) => !saved)}
          >
            <Bookmark
              size={15}
              fill={isWatchlisted ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
          <button
            className="category-lead-control category-lead-playback"
            type="button"
            disabled={!canPlay}
            onClick={() => {
              if (canPlay) onPlay(broadcast.id);
            }}
            aria-label={
              canPlay
                ? `${isPlaying ? 'Stop' : 'Play'} ${broadcast.name}'s broadcast`
                : `${broadcast.name}'s broadcast is not ready to play`
            }
          >
            {isPlaying ? (
              <Pause size={15} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={15} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            className="category-lead-control category-lead-sound"
            type="button"
            disabled={!hasLocalDemo}
            onClick={() => setIsMuted((muted) => !muted)}
            aria-label={isMuted ? 'Turn on video sound' : 'Mute video'}
          >
            {isMuted ? (
              <VolumeX size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <div className="category-lead-content">
        <div className="category-lead-market">
          <span className="category-lead-rank">
            <b>#{broadcast.rank}</b>
            <em>
              <i /> LIVE
            </em>
          </span>
          <div className="category-lead-stack">
            <div className="category-lead-value">
              <small>CURRENT BID</small>
              <strong>{broadcast.price}</strong>
            </div>
            <div className="category-lead-proof">
              <span className="category-lead-stat">
                <Eye size={13} aria-hidden="true" />
                <span>
                  <strong>{broadcast.views.toLocaleString('en-US')}</strong>
                  <small>VIEWS</small>
                </span>
              </span>
              <span className="category-lead-stat">
                <Share2 size={13} aria-hidden="true" />
                <span>
                  <strong>{broadcast.shares.toLocaleString('en-US')}</strong>
                  <small>SHARES</small>
                </span>
              </span>
              <span className="category-lead-stat category-lead-outbid">
                <UsersRound size={13} aria-hidden="true" />
                <span>
                  <strong>{broadcast.outbidCount.toLocaleString('en-US')}</strong>
                  <small>OUTBID</small>
                </span>
              </span>
            </div>
            <span className="category-lead-take">
              <strong>TAKE THIS SPOT</strong>
              <b>{broadcast.takePrice}</b>
            </span>
            <div className="category-lead-author">
              <ProfileAvatar
                initials={broadcast.initials}
                imageSrc="/leaderboard-portraits.png"
                imagePosition={broadcast.imagePosition}
                className="category-lead-author-avatar"
              />
              <span>
                <strong>{broadcast.name}</strong>
                <small>{broadcast.handle}</small>
              </span>
              <span className="category-lead-author-platform">
                {broadcast.socialPlatform}
              </span>
            </div>
          </div>
        </div>
        <div className="category-lead-copy">
          <span>{category.name}</span>
          <h2>&ldquo;{broadcast.title}&rdquo;</h2>
          <small className="category-lead-tagline">
            BOLD IDEAS MOVE THINGS FORWARD.
          </small>
        </div>
      </div>
    </section>
  );
}

const CategoryPanel = memo(function CategoryPanel({
  category,
  categoryIndex,
  playingId,
  onPlay,
  selectedBroadcastId,
  onSelectBroadcast,
  visibleCount,
  onLoadMore,
  dropIdsByRank,
}: {
  category: CategoryDefinition;
  categoryIndex: number;
  playingId: string | null;
  onPlay: (id: string) => void;
  selectedBroadcastId: string | null;
  onSelectBroadcast: (id: string) => void;
  visibleCount: number;
  onLoadMore: (categoryName: string) => void;
  dropIdsByRank: Record<number, string>;
}) {
  const broadcasts = categoryBroadcasts[categoryIndex];
  const leader = broadcasts[0];
  const featuredBroadcast =
    broadcasts.find(({ id }) => id === selectedBroadcastId) ?? leader;
  const loadedCount = Math.min(visibleCount, broadcasts.length);
  const hasMore = loadedCount < broadcasts.length;
  const listRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const expandedBroadcastRef = useRef<HTMLDivElement>(null);
  const categoryStyle = {
    '--category-accent': category.accent,
  } as CSSProperties;

  useEffect(() => {
    loadingMoreRef.current = false;
  }, [loadedCount]);

  useEffect(() => {
    if (!selectedBroadcastId) return;

    expandedBroadcastRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedBroadcastId]);

  function loadNextBatch() {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    onLoadMore(category.name);
  }

  return (
    <article
      className="category-market-panel is-active"
      style={categoryStyle}
      aria-label={`${category.name} category, selected`}
    >
      <div className="category-market-panel-inner">
        <div className="category-market-list-head">
          <strong>LIVE POSITIONS</strong>
          <span className="category-market-list-actions">
            {loadedCount} OF {broadcasts.length.toLocaleString('en-US')}
          </span>
        </div>

        <div
          ref={listRef}
          className="category-market-list category-position-list"
          aria-label="Live positions"
          onScroll={(event) => {
            const list = event.currentTarget;
            const remaining =
              list.scrollHeight - list.scrollTop - list.clientHeight;
            if (remaining <= 24) loadNextBatch();
          }}
        >
          {broadcasts.slice(0, loadedCount).map((broadcast) => {
            const isExpanded = featuredBroadcast.id === broadcast.id;

            if (isExpanded) {
              return (
                <div
                  ref={expandedBroadcastRef}
                  className="category-position-expanded"
                  key={broadcast.id}
                  aria-label={`Position #${broadcast.rank} expanded${playingId === broadcast.id ? ' and playing' : ''}`}
                >
                  <BroadcastVideoCard
                    broadcast={broadcast}
                    category={category}
                    playingId={playingId}
                    onPlay={onPlay}
                    loadThumbnail
                    dropId={dropIdsByRank[broadcast.rank] ?? null}
                    useSharedDemoVideo
                  />
                </div>
              );
            }

            return (
              <button
                className="category-position-row"
                key={broadcast.id}
                type="button"
                aria-label={`Open and play position #${broadcast.rank}, ${broadcast.price}, ${broadcast.title}`}
                onClick={() => onSelectBroadcast(broadcast.id)}
              >
                <span className="category-position-rank">#{broadcast.rank}</span>
                <ProfileAvatar
                  initials={broadcast.initials}
                  imageSrc="/leaderboard-portraits.png"
                  imagePosition={broadcast.imagePosition}
                  className="category-position-avatar"
                  alt={broadcast.name}
                />
                <span className="category-position-copy">
                  <strong>{broadcast.title}</strong>
                  <small>
                    {broadcast.name} · {broadcast.handle}
                  </small>
                </span>
                <span className="category-position-bid">
                  <small>CURRENT BID</small>
                  <strong>{broadcast.price}</strong>
                </span>
                <span
                  className={`category-position-change ${broadcast.change > 0 ? 'is-up' : 'is-down'}`}
                >
                  {broadcast.change > 0 ? '+' : ''}
                  {broadcast.change}%
                </span>
                <span className="category-position-next">
                  <small>TAKE THIS SPOT</small>
                  <strong>{broadcast.takePrice}</strong>
                </span>
              </button>
            );
          })}

        </div>

        {hasMore && (
          <button
            className="category-market-view-more"
            type="button"
            aria-label={`Load positions ${loadedCount + 1}–${Math.min(loadedCount + broadcastBatchSize, broadcasts.length)}`}
            onClick={loadNextBatch}
          >
            <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </article>
  );
});

CategoryPanel.displayName = 'CategoryPanel';

export default function CategoriesPage() {
  const { entries } = useBought();
  const [activeIndex, setActiveIndex] = useState(0);
  const [featuredBroadcastId, setFeaturedBroadcastId] = useState<string | null>(
    null,
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    {},
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const stageRef = useRef<HTMLElement | null>(null);
  const activeIndexRef = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  const pageScrollFrame = useRef<number | null>(null);

  const allCategory = categories[0];
  const AllCategoryIcon = allCategory.icon;

  const scrollToCategory = useCallback(
    (index: number, behavior: ScrollBehavior = 'auto') => {
      const stage = stageRef.current;
      const slot = slotRefs.current[index];
      if (!stage || !slot) return;

      const left = slot.offsetLeft - (stage.clientWidth - slot.offsetWidth) / 2;
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

  useEffect(() => {
    function handlePageScroll() {
      if (pageScrollFrame.current !== null) return;

      pageScrollFrame.current = window.requestAnimationFrame(() => {
        pageScrollFrame.current = null;
        setShowBackToTop(window.scrollY > 480);
      });
    }

    handlePageScroll();
    window.addEventListener('scroll', handlePageScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handlePageScroll);
      if (pageScrollFrame.current !== null)
        window.cancelAnimationFrame(pageScrollFrame.current);
    };
  }, []);

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
    setFeaturedBroadcastId(null);
    setPlayingId(null);
    scrollToCategory(nextIndex, 'auto');
  }

  const toggleBroadcast = useCallback((id: string) => {
    setPlayingId((current) => (current === id ? null : id));
  }, []);

  const selectBroadcast = useCallback((id: string) => {
    setFeaturedBroadcastId(id);
    setPlayingId(null);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadMoreBroadcasts = useCallback((categoryName: string) => {
    const categoryIndex = categories.findIndex(
      (category) => category.name === categoryName,
    );
    if (categoryIndex < 0) return;

    setVisibleCounts((current) => ({
      ...current,
      [categoryName]: Math.min(
        (current[categoryName] ?? initialBroadcastCount) + broadcastBatchSize,
        categoryBroadcasts[categoryIndex].length,
      ),
    }));
  }, []);

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
      setFeaturedBroadcastId(null);
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
          <div className="dashboard-section-head category-selector-head">
            <span className="category-page-heading">
              <strong>CATEGORIES</strong>
            </span>
            <button
              ref={(element) => {
                tabRefs.current[0] = element;
              }}
              className={`homepage-category-option ${activeIndex === 0 ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeIndex === 0}
              aria-label={`${allCategory.name}, ${allCategory.liveCount} bids`}
              onClick={() => selectCategory(0)}
              onKeyDown={handleKeyDown}
            >
              <AllCategoryIcon
                className="homepage-category-icon"
                size={13}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <strong>{allCategory.name}</strong>
              <span>{allCategory.liveCount} bids</span>
            </button>
          </div>
          <div
            className="homepage-category-list"
            role="tablist"
            aria-label="Market categories"
          >
            {categories.slice(1).map((category, index) => {
              const categoryIndex = index + 1;
              const Icon = category.icon;
              const isTrending = category.name === 'BEEF';
              return (
                <button
                  ref={(element) => {
                    tabRefs.current[categoryIndex] = element;
                  }}
                  className={`homepage-category-option ${activeIndex === categoryIndex ? 'is-active' : ''} ${isTrending ? 'is-trending' : ''}`}
                  key={category.name}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === categoryIndex}
                  aria-label={`${category.name}, ${category.liveCount} bids${isTrending ? ', trending today' : ''}`}
                  onClick={() => selectCategory(categoryIndex)}
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
                {position === 'active' && (
                  <CategoryPanel
                    category={category}
                    categoryIndex={index}
                    playingId={playingId}
                    onPlay={toggleBroadcast}
                    selectedBroadcastId={featuredBroadcastId}
                    onSelectBroadcast={selectBroadcast}
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
                )}
              </div>
            );
          })}
        </section>

        <div className="category-carousel-footer-nav" aria-hidden="true">
          <div>
            {categories.map((category, index) => (
              <i
                className={index === activeIndex ? 'is-active' : ''}
                key={category.name}
              />
            ))}
          </div>
        </div>

        <MarketFooter />
      </div>

      {showBackToTop && (
        <button
          className="category-back-to-top"
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top of categories"
        >
          <ArrowUp size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>TOP</span>
        </button>
      )}
    </main>
  );
}
