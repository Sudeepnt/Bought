'use client';

import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Building2,
  ChevronUp,
  ChevronDown,
  Check,
  Copy,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Gavel,
  MessageCircle,
  Mic,
  Maximize,
  Minimize,
  Radio,
  Rocket,
  Send,
  Share2,
  Undo2,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';

import { MarketTopbar } from '@/components/market-topbar';
import { DropPlayer } from '@/components/drop-player';
import { ProfileAvatar } from '@/components/profile-avatar';
import { SocialPlatformIcon } from '@/components/social-brand-icons';
import { useBought } from '@/components/bought-provider';
import { appendDirectMessage } from '@/lib/direct-messages';
import { portraitVideoAspectRatio } from '@/lib/video-aspect-ratio';

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

export type CategoryBroadcast = Creator & {
  id: string;
  categoryName: string;
  rank: number;
  title: string;
  price: string;
  change: number;
  views: number;
  shares: number;
  outbidCount: number;
  takePrice: string;
  topRankedAt: string;
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
    name: 'PRODUCT LAUNCH',
    description: 'Launches, first customers, and what happens next.',
    liveCount: '42',
    accent: '#f19132',
    topBid: 7800,
    leaderOffset: 3,
    leadTitle: 'The launch plan we rewrote after our first customers.',
    icon: Rocket,
  },
];

const trendingCategoryIndex = categories.findIndex(
  (category) => category.name === 'PRODUCT LAUNCH',
);
const categoryTabIndices = [
  0,
  trendingCategoryIndex,
  ...categories
    .map((_, index) => index)
    .filter((index) => index > 0 && index !== trendingCategoryIndex),
];

function formatPrice(value: number) {
  return `$${value.toLocaleString('en-US')}`;
}

function formatRelativeTime(minutesAgo: number) {
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

function priceValue(price: string) {
  return Number(price.replace(/[$,]/g, ''));
}

function makeBroadcasts(
  category: CategoryDefinition,
  categoryIndex: number,
): CategoryBroadcast[] {
  const step = Math.max(280, Math.round(category.topBid / 17));
  const broadcastCount = Number(category.liveCount.replaceAll(',', ''));

  return Array.from({ length: broadcastCount }, (_, index) => {
    const creator = creators[(category.leaderOffset + index) % creators.length];
    const views = Math.max(1900, 14000 - index * 1040);
    const changeMagnitude = 2 + ((categoryIndex * 5 + index * 3) % 14);
    const change =
      (categoryIndex + index) % 4 === 0 ? -changeMagnitude : changeMagnitude;
    const bidValue = Math.max(1800, category.topBid - index * step);
    const shares = Math.max(18, 327 - index * 23);
    const outbidCount = Math.max(
      0,
      3 + (categoryIndex % 3) - Math.min(index, 4),
    );
    const broadcastAgeMinutes = 18 + categoryIndex * 11 + index * 3;
    const topRankedMinutesAgo = Math.max(
      4,
      broadcastAgeMinutes - (5 + (index % 6)),
    );

    return {
      ...creator,
      id: `${category.name}-${index + 1}`,
      categoryName: category.name,
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
      topRankedAt: formatRelativeTime(topRankedMinutesAgo),
    };
  });
}

const categoryLists = categories.slice(1).map((category, index) =>
  makeBroadcasts(category, index + 1),
);
const allBroadcasts = categoryLists
  .flat()
  .sort((a, b) => priceValue(b.price) - priceValue(a.price))
  .map((broadcast, index) => ({
    ...broadcast,
    id: `ALL-${broadcast.id}`,
    rank: index + 1,
  }));
const categoryBroadcasts = [allBroadcasts, ...categoryLists];

const initialBroadcastCount = 10;
const broadcastBatchSize = 20;

function socialSearchUrl(platform: string, handle: string) {
  const query = encodeURIComponent(handle.replace(/^@/, ''));
  if (platform === 'LinkedIn') return `https://www.linkedin.com/search/results/people/?keywords=${query}`;
  if (platform === 'YouTube') return `https://www.youtube.com/results?search_query=${query}`;
  if (platform === 'TikTok') return `https://www.tiktok.com/search?q=${query}`;
  if (platform === 'Instagram') return `https://www.instagram.com/explore/search/keyword/?q=${query}`;
  return `https://x.com/search?q=${query}&src=typed_query`;
}

function VideoThumbnail({
  broadcast,
  prominent = false,
  shouldLoad = false,
}: {
  broadcast: CategoryBroadcast;
  prominent?: boolean;
  shouldLoad?: boolean;
}) {
  const prominentImage = prominent
    ? broadcast.rank === 2
      ? '/category-feature-portrait-poster.jpg'
      : '/category-feature-poster.jpg'
    : null;
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
          style={{ objectFit: 'contain' }}
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

function videoClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function broadcastShareUrl(broadcast: CategoryBroadcast) {
  const url = new URL('/categories', window.location.origin);
  url.searchParams.set('category', broadcast.id.startsWith('ALL-') ? 'ALL' : broadcast.categoryName);
  url.searchParams.set('broadcast', broadcast.id);
  return url.toString();
}

function SpreadPositionDialog({ broadcast, onClose }: {
  broadcast: CategoryBroadcast;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const url = broadcastShareUrl(broadcast);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError('');
    } catch {
      setError('Could not copy automatically. Select the link below to copy it.');
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: broadcast.title, url });
      setError('');
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError('Could not open sharing. Copy the link instead.');
      }
    }
  }

  return createPortal(
    <div className="category-action-backdrop">
      <dialog open className="category-action-dialog" aria-modal="true" aria-labelledby={`spread-title-${broadcast.id}`}>
        <div className="category-action-head">
          <div>
            <small>SPREAD THIS BROADCAST</small>
            <h2 id={`spread-title-${broadcast.id}`}>Spread this position</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close spread dialog"><X size={18} /></button>
        </div>
        <p className="category-action-description">Send a direct link to {broadcast.name}&apos;s video.</p>
        <div className="category-action-copy">
          <input readOnly aria-label="Broadcast link" value={url} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={copyLink}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        {typeof navigator.share === 'function' && (
          <button className="category-action-primary category-action-share" type="button" onClick={() => { void shareLink(); }}>
            <Share2 size={15} aria-hidden="true" /> Share link
          </button>
        )}
        {error && <p className="category-action-error" role="alert">{error}</p>}
      </dialog>
    </div>,
    document.body,
  );
}

export function BroadcastVideoCard({
  broadcast: selectedBroadcast,
  playingId,
  onPlay,
  loadThumbnail,
  dropId,
  reelBroadcasts,
  onReelExit,
  initialPlaybackTime = 0,
  useSharedDemoVideo = false,
  thumbnailPreview = false,
  onPreviewSpread,
  onPreviewSelect,
  accentColor,
}: {
  broadcast: CategoryBroadcast;
  playingId: string | null;
  onPlay: (id: string) => void;
  loadThumbnail: boolean;
  dropId: string | null;
  reelBroadcasts?: CategoryBroadcast[];
  onReelExit?: (broadcast: CategoryBroadcast, resume: boolean, time: number) => void;
  initialPlaybackTime?: number;
  useSharedDemoVideo?: boolean;
  thumbnailPreview?: boolean;
  onPreviewSpread?: (broadcast: CategoryBroadcast) => void;
  onPreviewSelect?: (broadcast: CategoryBroadcast) => void;
  accentColor?: string;
}) {
  const { session } = useBought();
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reelIndex, setReelIndex] = useState<number | null>(null);
  const [reelPlaybackActive, setReelPlaybackActive] = useState(false);
  const [playIntent, setPlayIntent] = useState(playingId === selectedBroadcast.id);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [reelSlideToken, setReelSlideToken] = useState(0);
  const [measuredAspectRatio, setMeasuredAspectRatio] = useState<number | null>(null);
  const [videoPosition, setVideoPosition] = useState({ current: 0, duration: 0 });
  const [opinions, setOpinions] = useState<Array<{ text: string; stance: 'agree' | 'disagree' }>>([]);
  const [opinionStep, setOpinionStep] = useState(0);
  const [opinionDraft, setOpinionDraft] = useState('');
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isSpreadOpen, setIsSpreadOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const lastReelMoveRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialTimeAppliedRef = useRef(false);
  const videoPositionRef = useRef({ current: 0, duration: 0 });
  const reelItems = useMemo(
    () => (reelBroadcasts?.length ? reelBroadcasts : [selectedBroadcast]),
    [reelBroadcasts, selectedBroadcast],
  );
  const selectedIndex = Math.max(0, reelItems.findIndex(({ id }) => id === selectedBroadcast.id));
  const activeReelIndex = reelIndex ?? selectedIndex;
  const broadcast = isFullscreen ? reelItems[activeReelIndex] ?? selectedBroadcast : selectedBroadcast;
  const nextBroadcast = reelItems[activeReelIndex + 1];
  const isPlaying = isFullscreen ? reelPlaybackActive : playingId === selectedBroadcast.id;
  const hasLocalDemo = useSharedDemoVideo || broadcast.rank === 1;
  const isPortraitDemo = hasLocalDemo && broadcast.rank === 2;
  const mediaAspectRatio = measuredAspectRatio ?? (isPortraitDemo && !thumbnailPreview ? 9 / 16 : null);
  const demoSource = isPortraitDemo
    ? '/video/category-feature-portrait.mp4'
    : '/video/category-feature.mp4';
  const demoPoster = isPortraitDemo
    ? '/category-feature-portrait-poster.jpg'
    : '/category-feature-poster.jpg';
  const canPlay = hasLocalDemo || Boolean(dropId);
  const showFloatingPlayer = isPlaying && (mediaPlaying || nextCountdown !== null) && isDocked && !isFullscreen;
  const handleMediaAspectChange = useCallback((width: number, height: number) => {
    const nextRatio = portraitVideoAspectRatio(width, height);
    setMeasuredAspectRatio((current) =>
      nextRatio !== null && current !== null && Math.abs(current - nextRatio) < 0.001
        ? current
        : nextRatio,
    );
  }, []);

  const changeReel = useCallback((direction: -1 | 1, fromGesture = false) => {
    if (!isFullscreen) return;
    const nextIndex = activeReelIndex + direction;
    if (nextIndex < 0 || nextIndex >= reelItems.length) return;
    const now = Date.now();
    if (fromGesture && now - lastReelMoveRef.current < 650) return;
    lastReelMoveRef.current = now;
    setNextCountdown(null);
    setReelIndex(nextIndex);
    setReelSlideToken((token) => token + 1);
    setReelPlaybackActive(playIntent);
    setMediaPlaying(false);
    setMeasuredAspectRatio(null);
    const nextPosition = { current: 0, duration: useSharedDemoVideo ? 60 : 0 };
    videoPositionRef.current = nextPosition;
    setVideoPosition(nextPosition);
  }, [activeReelIndex, isFullscreen, playIntent, reelItems.length, useSharedDemoVideo]);

  useEffect(() => {
    if (nextCountdown === null) return;
    const timer = window.setTimeout(() => {
      if (nextCountdown > 1) {
        setNextCountdown(nextCountdown - 1);
        return;
      }
      setNextCountdown(null);
      if (!nextBroadcast) return;
      if (isFullscreen) changeReel(1);
      else onReelExit?.(nextBroadcast, true, 0);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [changeReel, isFullscreen, nextBroadcast, nextCountdown, onReelExit]);

  const finishFullscreen = useCallback(() => {
    const activeBroadcast = reelItems[activeReelIndex] ?? selectedBroadcast;
    const resume = reelPlaybackActive && playIntent;
    const time = videoRef.current?.currentTime ?? videoPositionRef.current.current;
    setIsFullscreen(false);
    setReelIndex(null);
    setReelPlaybackActive(false);
    if (
      onReelExit &&
      (activeBroadcast.id !== selectedBroadcast.id || (resume && playingId !== selectedBroadcast.id))
    ) {
      onReelExit(activeBroadcast, resume, time);
    }
  }, [activeReelIndex, onReelExit, playIntent, playingId, reelItems, reelPlaybackActive, selectedBroadcast]);

  function updateVideoPosition(current: number, duration: number) {
    const next = {
      current: Number.isFinite(current) ? current : 0,
      duration: Number.isFinite(duration) ? duration : 0,
    };
    videoPositionRef.current = next;
    setVideoPosition(next);
  }

  const pauseBroadcast = () => {
    setPlayIntent(false);
    if (hasLocalDemo) {
      videoRef.current?.pause();
    } else {
      const muxPlayer = floatingRef.current?.querySelector('mux-player') as
        | (HTMLElement & { pause?: () => void })
        | null;
      muxPlayer?.pause?.();
    }
    setMediaPlaying(false);
  };

  const resumeBroadcast = () => {
    setPlayIntent(true);
    if (videoRef.current?.ended) videoRef.current.currentTime = 0;
    const player = hasLocalDemo
      ? videoRef.current
      : (floatingRef.current?.querySelector('mux-player') as
          | (HTMLElement & { play?: () => Promise<void> })
          | null);
    void player?.play?.()?.catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Unable to resume the broadcast.', error);
      }
    });
  };

  useLayoutEffect(() => {
    if (!isPlaying || isFullscreen) return;

    const placeholder = placeholderRef.current;
    const floatingCard = floatingRef.current;
    if (!placeholder || !floatingCard) return;

    let frame: number | null = null;
    const updatePosition = () => {
      const rect = placeholder.getBoundingClientRect();
      floatingCard.style.setProperty('--broadcast-source-top', `${rect.top}px`);
      floatingCard.style.setProperty('--broadcast-source-left', `${rect.left}px`);
      floatingCard.style.setProperty('--broadcast-source-width', `${rect.width}px`);
      floatingCard.style.setProperty('--broadcast-source-height', `${rect.height}px`);
      setIsDocked((mediaPlaying || nextCountdown !== null) && rect.bottom <= 0);
    };
    const schedulePosition = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener('scroll', schedulePosition, { passive: true });
    document.addEventListener('scroll', schedulePosition, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', schedulePosition);

    return () => {
      window.removeEventListener('scroll', schedulePosition);
      document.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener('resize', schedulePosition);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [isPlaying, isFullscreen, mediaAspectRatio, mediaPlaying, nextCountdown]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement !== floatingRef.current) {
        finishFullscreen();
      }
      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        !(event.target instanceof HTMLInputElement)
      ) {
        event.preventDefault();
        changeReel(event.key === 'ArrowDown' ? 1 : -1, true);
      }
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== floatingRef.current) finishFullscreen();
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [changeReel, finishFullscreen, isFullscreen]);

  async function toggleFullscreen() {
    clearControlsTimer();
    setControlsVisible(true);
    if (isFullscreen) {
      if (document.fullscreenElement === floatingRef.current) {
        try {
          await document.exitFullscreen();
        } catch {
          finishFullscreen();
        }
      } else {
        finishFullscreen();
      }
      return;
    }

    // Keep a CSS fullscreen fallback for iPhone Safari and other browsers
    // without element fullscreen support.
    setReelIndex(selectedIndex);
    setReelPlaybackActive(playingId === selectedBroadcast.id);
    if (hasLocalDemo && !videoPositionRef.current.duration) {
      updateVideoPosition(0, 60);
    }
    setIsFullscreen(true);
    if (isPlaying && floatingRef.current?.requestFullscreen) {
      try {
        await floatingRef.current.requestFullscreen();
      } catch {
        // The fixed viewport player remains available when native fullscreen is denied.
      }
    }
  }

  function submitOpinion(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextOpinion = opinionDraft.trim();
    if (!nextOpinion) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const stance = submitter?.value === 'disagree' ? 'disagree' : 'agree';
    setOpinions((current) => [...current, { text: nextOpinion, stance }]);
    setOpinionStep(0);
    setOpinionDraft('');
  }

  useEffect(() => {
    if (opinions.length === 0) return;
    const timer = window.setInterval(() => setOpinionStep((step) => step + 1), 3000);
    return () => window.clearInterval(timer);
  }, [opinions.length]);

  function submitMessage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body) return;
    try {
      const thread = appendDirectMessage({
        ownerId: session?.user.id ?? 'guest',
        contact: {
          id: broadcast.handle.toLowerCase(),
          name: broadcast.name,
          handle: broadcast.handle,
          initials: broadcast.initials,
          imageSrc: '/leaderboard-portraits.png',
          imagePosition: broadcast.imagePosition,
        },
        context: {
          broadcastId: broadcast.id,
          broadcastTitle: broadcast.title,
          categoryName: broadcast.categoryName,
        },
        body,
      });
      setMessageDraft('');
      setMessageError('');
      window.location.assign(`/chat?thread=${encodeURIComponent(thread.id)}`);
    } catch (reason) {
      setMessageError(
        reason instanceof Error
          ? reason.message
          : 'The message could not be saved.',
      );
    }
  }

  useEffect(() => {
    if (!isMessageOpen) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMessageOpen(false);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMessageOpen]);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current === null) return;
    window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = null;
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearControlsTimer();
    if (isPlaying && !isFullscreen)
      controlsTimerRef.current = window.setTimeout(
        () => setControlsVisible(false),
        2400,
      );
  }, [clearControlsTimer, isPlaying, isFullscreen]);

  useEffect(() => {
    if (!isPlaying) {
      clearControlsTimer();
      return;
    }

    const frame = window.requestAnimationFrame(revealControls);
    return () => {
      window.cancelAnimationFrame(frame);
      clearControlsTimer();
    };
  }, [clearControlsTimer, isPlaying, revealControls]);

  useEffect(() => {
    if (!hasLocalDemo || !videoRef.current) return;

    if (isPlaying && playIntent) {
      const playRequest = videoRef.current.play();
      void playRequest.catch((error: unknown) => {
        // Rapid play/pause changes intentionally cancel the pending request.
        // Swallow that browser-level cancellation so it does not surface as
        // an unhandled promise rejection in the preview or production UI.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Unable to play the category broadcast.', error);
      });
      return;
    }

    videoRef.current.pause();
  }, [broadcast.id, hasLocalDemo, isPlaying, playIntent]);

  const mediaAspectStyle = mediaAspectRatio
    ? ({ '--category-video-aspect-ratio': mediaAspectRatio } as CSSProperties)
    : undefined;
  const cardStyle = {
    ...(accentColor ? { '--category-accent': accentColor } : {}),
    ...(mediaAspectRatio
      ? { '--category-video-aspect-ratio': mediaAspectRatio }
      : {}),
  } as CSSProperties;
  const recentOpinions = opinions.slice(-4).reverse();
  const liveOpinion = recentOpinions[opinionStep % recentOpinions.length];
  const card = (
    <section
      ref={floatingRef}
      className={`category-lead-card category-broadcast-video ${mediaAspectRatio ? 'is-portrait-video' : ''} ${isPlaying ? 'is-playing' : ''} ${isPlaying || isFullscreen ? 'is-player-portaled' : ''} ${isFullscreen ? 'is-video-fullscreen' : ''} ${mediaPlaying ? 'is-media-playing' : ''} ${mediaPlaying && !controlsVisible ? 'controls-hidden' : ''} ${showFloatingPlayer ? 'is-docked' : ''}`}
      style={cardStyle}
      onWheel={(event) => {
        if (!isFullscreen || Math.abs(event.deltaY) < 12) return;
        changeReel(event.deltaY > 0 ? 1 : -1, true);
      }}
      onTouchStart={(event) => {
        if (!isFullscreen) return;
        touchStartRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }}
      onTouchEnd={(event) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!isFullscreen || !start) return;
        const deltaX = event.changedTouches[0].clientX - start.x;
        const deltaY = event.changedTouches[0].clientY - start.y;
        if (Math.abs(deltaY) < 60 || Math.abs(deltaY) < Math.abs(deltaX) * 1.3) return;
        changeReel(deltaY < 0 ? 1 : -1, true);
      }}
    >
      <div
        key={reelSlideToken}
        className={`category-lead-media ${isFullscreen && reelSlideToken > 0 ? 'is-reel-rising' : ''}`}
        onPointerDown={revealControls}
        onPointerMove={revealControls}
      >
        <VideoThumbnail
          broadcast={broadcast}
          prominent
          shouldLoad={loadThumbnail}
        />
        {hasLocalDemo && isPlaying && (
          <div className="category-on-demand-player category-local-player">
            <video
              key={broadcast.id}
              ref={videoRef}
              src={demoSource}
              poster={demoPoster}
              playsInline
              preload="metadata"
              aria-label={`${broadcast.name}'s one-minute featured broadcast`}
              onLoadedMetadata={(event) => {
                handleMediaAspectChange(
                  event.currentTarget.videoWidth,
                  event.currentTarget.videoHeight,
                );
                if (
                  !initialTimeAppliedRef.current &&
                  initialPlaybackTime > 0 &&
                  broadcast.id === selectedBroadcast.id
                ) {
                  event.currentTarget.currentTime = Math.min(
                    initialPlaybackTime,
                    event.currentTarget.duration,
                  );
                  initialTimeAppliedRef.current = true;
                }
                updateVideoPosition(event.currentTarget.currentTime, event.currentTarget.duration);
              }}
              onTimeUpdate={(event) =>
                updateVideoPosition(event.currentTarget.currentTime, event.currentTarget.duration)
              }
              onDurationChange={(event) =>
                updateVideoPosition(event.currentTarget.currentTime, event.currentTarget.duration)
              }
              onPlaying={() => setMediaPlaying(true)}
              onPause={() => setMediaPlaying(false)}
              onEnded={() => {
                setMediaPlaying(false);
                clearControlsTimer();
                setControlsVisible(true);
                if (playIntent && nextBroadcast && (isFullscreen || onReelExit)) {
                  setNextCountdown(10);
                } else {
                  setPlayIntent(false);
                }
              }}
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
            <DropPlayer
              key={broadcast.id}
              dropId={dropId}
              onPlayingChange={setMediaPlaying}
              onAspectRatioChange={handleMediaAspectChange}
              onProgressChange={updateVideoPosition}
            />
          </div>
        )}
        <span className="category-lead-shade" aria-hidden="true" />
        {thumbnailPreview && (
          <button
            className="category-position-preview-open"
            type="button"
            aria-label={`Open position #${broadcast.rank}`}
            onClick={() => onPreviewSelect?.(broadcast)}
          />
        )}
        <button
          className={`category-lead-mic ${nextCountdown !== null ? 'is-next-countdown' : ''}`}
          type="button"
          disabled={!canPlay}
          tabIndex={mediaPlaying && !controlsVisible ? -1 : 0}
          title={nextCountdown !== null ? 'Click to stop the next video' : undefined}
          onClick={() => {
            if (!canPlay) return;
            if (nextCountdown !== null) {
              setNextCountdown(null);
              setPlayIntent(false);
              return;
            }
            if (!isPlaying) {
              if (thumbnailPreview) {
                onPlay(selectedBroadcast.id);
                return;
              }
              setPlayIntent(true);
              if (isFullscreen) setReelPlaybackActive(true);
              else onPlay(selectedBroadcast.id);
            }
            else if (mediaPlaying) pauseBroadcast();
            else resumeBroadcast();
          }}
          aria-label={
            nextCountdown !== null
              ? `Next video in ${nextCountdown} seconds. Click to stop.`
              : canPlay
              ? `${isPlaying && mediaPlaying ? 'Pause' : 'Play'} ${broadcast.name}'s broadcast`
              : `${broadcast.name}'s broadcast is not ready to play`
          }
          style={nextCountdown !== null ? { '--next-progress': `${(10 - nextCountdown) * 10}%` } as CSSProperties : undefined}
        >
          {nextCountdown !== null ? (
            <span className="category-next-countdown-label"><strong>{nextCountdown}</strong><small>NEXT</small></span>
          ) : (
            <Mic size={25} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
        <div
          className={`category-stage-status ${mediaPlaying ? 'is-visible' : ''}`}
          aria-hidden={!mediaPlaying}
        >
          <i aria-hidden="true" />
          <span>
            <strong>ON STAGE</strong>
            <small>LIVE TO THE WORLD</small>
          </span>
        </div>
        {liveOpinion && (
          <div
            className="category-live-comment-stream"
            aria-hidden="true"
          >
            <span className="category-live-comment" key={`${opinions.length}-${opinionStep}`}>
              {liveOpinion.text}
            </span>
          </div>
        )}
        <div className="category-lead-media-actions">
          <button
            className="category-lead-control category-lead-spread-action"
            type="button"
            tabIndex={!mediaPlaying || controlsVisible ? 0 : -1}
            aria-label={`Spread ${broadcast.name}'s broadcast`}
            onClick={() => onPreviewSpread ? onPreviewSpread(broadcast) : setIsSpreadOpen(true)}
          >
            <Share2 size={15} aria-hidden="true" />
            <span>SPREAD IT</span>
          </button>
          <button
            className="category-lead-control category-lead-fullscreen"
            type="button"
            tabIndex={!mediaPlaying || controlsVisible ? 0 : -1}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            onClick={() => { void toggleFullscreen(); }}
          >
            {isFullscreen ? <Minimize size={15} aria-hidden="true" /> : <Maximize size={15} aria-hidden="true" />}
          </button>
          <button
            className={`category-lead-control category-lead-watchlist ${isWatchlisted ? 'is-saved' : ''}`}
            type="button"
            tabIndex={!mediaPlaying || controlsVisible ? 0 : -1}
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
        </div>
        {isFullscreen && reelItems.length > 1 && (
          <nav className="category-reel-navigation" aria-label="Fullscreen videos">
            <button
              type="button"
              disabled={activeReelIndex === 0}
              onClick={() => changeReel(-1)}
              aria-label="Previous video"
            >
              <ChevronUp size={20} aria-hidden="true" />
            </button>
            <span aria-live="polite">{activeReelIndex + 1} / {reelItems.length}</span>
            <button
              type="button"
              disabled={activeReelIndex === reelItems.length - 1}
              onClick={() => changeReel(1)}
              aria-label="Next video"
            >
              <ChevronDown size={20} aria-hidden="true" />
            </button>
          </nav>
        )}
        {isFullscreen && (
          <time className="category-video-elapsed" aria-label={`Elapsed video time ${videoClock(videoPosition.current)}`}>
            {videoClock(videoPosition.current)}
          </time>
        )}
      </div>
      <div key={reelSlideToken} className={`category-lead-content ${isFullscreen && reelSlideToken > 0 ? 'is-reel-rising' : ''}`}>
        <div className="category-lead-market">
          <span className="category-lead-rank">
            <b>#{broadcast.rank}</b>
            <em aria-label={`Live, ${broadcast.topRankedAt}`}>
              <i />
              <span>LIVE</span>
              <small>{broadcast.topRankedAt}</small>
            </em>
          </span>
          <div className="category-lead-stack">
            <div className="category-lead-proof">
              <span className="category-lead-stat">
                <Eye size={13} aria-hidden="true" />
                <span>
                  <strong>
                    <span className="category-lead-stat-full">
                      {broadcast.views.toLocaleString('en-US')}
                    </span>
                    <span className="category-lead-stat-compact">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(broadcast.views)}
                    </span>
                  </strong>
                  <small>
                    <span className="category-lead-stat-full">saw this</span>
                    <span className="category-lead-stat-compact">views</span>
                  </small>
                </span>
              </span>
              <button
                className="category-lead-stat category-lead-spread"
                type="button"
                onClick={() => onPreviewSpread ? onPreviewSpread(broadcast) : setIsSpreadOpen(true)}
                aria-label={`Spread ${broadcast.name}'s broadcast`}
              >
                <Share2 size={13} aria-hidden="true" />
                <span>
                  <strong>
                    <span className="category-lead-stat-full">
                      {broadcast.shares.toLocaleString('en-US')}
                    </span>
                    <span className="category-lead-stat-compact">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(broadcast.shares)}
                    </span>
                  </strong>
                  <small>
                    <span className="category-lead-stat-full">spreads</span>
                    <span className="category-lead-stat-compact">spread</span>
                  </small>
                </span>
              </button>
              <span className="category-lead-stat category-lead-outbid">
                <UsersRound size={13} aria-hidden="true" />
                <span>
                  <strong>
                    <span className="category-lead-stat-full">
                      {broadcast.outbidCount.toLocaleString('en-US')}
                    </span>
                    <span className="category-lead-stat-compact">
                      {new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(broadcast.outbidCount)}
                    </span>
                  </strong>
                  <small>
                    <span className="category-lead-stat-full">outbid this</span>
                    <span className="category-lead-stat-compact">outbid</span>
                  </small>
                </span>
              </span>
            </div>
            <div className="category-lead-bid-panel">
              <div className="category-lead-value">
                <small>
                  <span className="category-lead-bid-full">CURRENT BID</span>
                  <span className="category-lead-bid-compact">BID</span>
                </small>
                <strong>{broadcast.price}</strong>
              </div>
              <span className="category-lead-take">
                <span className="category-lead-take-label">
                  <Gavel size={26} aria-hidden="true" />
                  <strong>
                    <span className="category-lead-take-full">TAKE THIS SPOT</span>
                    <span className="category-lead-take-compact">TAKE</span>
                  </strong>
                </span>
                <b>{broadcast.takePrice}</b>
              </span>
            </div>
            <div className="category-lead-author">
              <span>
                <strong>{broadcast.name}</strong>
                <small>{broadcast.handle}</small>
              </span>
              <button
                className="category-lead-message-button category-lead-author-message"
                type="button"
                aria-label={
                  `Message ${broadcast.name}`
                }
                aria-expanded={isMessageOpen}
                onClick={() => {
                  setIsMessageOpen(true);
                  setMessageError('');
                }}
              >
                <Send size={11} aria-hidden="true" />
                {`MESSAGE ${broadcast.name.toUpperCase()}`}
              </button>
              <a
                className="category-lead-author-platform"
                href={socialSearchUrl(broadcast.socialPlatform, broadcast.handle)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Find ${broadcast.handle} on ${broadcast.socialPlatform}`}
                aria-label={`Find ${broadcast.handle} on ${broadcast.socialPlatform}`}
              >
                <SocialPlatformIcon
                  platform={broadcast.socialPlatform}
                  size={16}
                  aria-label={`${broadcast.socialPlatform} profile`}
                  aria-hidden={false}
                />
              </a>
            </div>
          </div>
        </div>
        <div className="category-lead-copy">
          <span>{broadcast.categoryName}</span>
          <h2>&ldquo;{broadcast.title}&rdquo;</h2>
        </div>
      </div>
    </section>
  );

  const dialogs = typeof document !== 'undefined' && isMessageOpen
    ? createPortal(
        <div className="category-action-backdrop">
          <dialog open className="category-action-dialog" aria-modal="true" aria-labelledby={`dm-title-${broadcast.id}`}>
              <div className="category-action-head">
                <div>
                  <small>DIRECT MESSAGE</small>
                  <h2 id={`dm-title-${broadcast.id}`}>Connect with {broadcast.name}</h2>
                  <p>Start a conversation about their take or share what resonated.</p>
                </div>
                <button type="button" onClick={() => setIsMessageOpen(false)} aria-label="Close message dialog"><X size={18} /></button>
              </div>
              <form className="category-action-form" onSubmit={submitMessage}>
                <label htmlFor={`message-${broadcast.id}`}>Your opening message</label>
                <textarea
                  id={`message-${broadcast.id}`}
                  autoFocus
                  value={messageDraft}
                  onChange={(event) => { setMessageDraft(event.target.value); setMessageError(''); }}
                  placeholder={`What would you like to talk about with ${broadcast.name}?`}
                  maxLength={240}
                  rows={4}
                />
                <small>Your conversation opens in Direct Messages after sending.</small>
                {messageError && <p className="category-action-error" role="alert">{messageError}</p>}
                <button className="category-action-primary" type="submit" disabled={!messageDraft.trim()}><Send size={15} /> Start conversation</button>
              </form>
          </dialog>
        </div>,
        document.body,
      )
    : null;

  const spreadDialog = isSpreadOpen && typeof document !== 'undefined'
    ? <SpreadPositionDialog broadcast={broadcast} onClose={() => setIsSpreadOpen(false)} />
    : null;

  if (!isPlaying && !isFullscreen) return <>{card}{dialogs}{spreadDialog}</>;

  return (
    <>
      <div
        ref={placeholderRef}
        className={`category-lead-placeholder ${mediaAspectRatio ? 'is-portrait-video' : ''}`}
        style={mediaAspectStyle}
        aria-hidden="true"
      />
      {useSharedDemoVideo && mediaPlaying && (
        <section
          className="category-video-comments"
          aria-label={`Opinions on ${broadcast.name}'s broadcast`}
        >
          <div className="category-video-comments-head">
            <span>
              <MessageCircle size={15} aria-hidden="true" />
              OPINIONS
            </span>
            <small>{opinions.length}</small>
          </div>
          <div className="category-video-comments-scroll" role="log" aria-live="polite">
            {opinions.length > 0 && (
              <ol className="category-video-comments-list">
                {opinions.map((opinion, index) => (
                  <li className="category-video-comment" key={`${index}-${opinion.text}`}>
                    <span className={`category-video-opinion-stance is-${opinion.stance}`}>
                      {opinion.stance === 'agree' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      {opinion.stance === 'agree' ? 'AGREE' : "DON'T AGREE"}
                    </span>
                    <p>{opinion.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <form className="category-video-comments-form" onSubmit={submitOpinion}>
            <label className="sr-only" htmlFor={`comment-${broadcast.id}`}>
              Share an opinion on {broadcast.name}&apos;s broadcast
            </label>
            <input
              id={`comment-${broadcast.id}`}
              type="text"
              value={opinionDraft}
              onChange={(event) => setOpinionDraft(event.target.value)}
              placeholder="Share your opinion..."
              maxLength={240}
            />
            <button type="submit" name="stance" value="agree" disabled={!opinionDraft.trim()} aria-label="Post opinion: I agree" title="I agree">
              <ArrowUp size={16} aria-hidden="true" /><span>AGREE</span>
            </button>
            <button type="submit" name="stance" value="disagree" disabled={!opinionDraft.trim()} aria-label="Post opinion: I don't agree" title="I don't agree">
              <ArrowDown size={16} aria-hidden="true" /><span>DON&apos;T</span>
            </button>
          </form>
        </section>
      )}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className={`market-shell dashboard-shell broadcast-floating-root ${showFloatingPlayer ? 'is-docked' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}>
            {card}
          </div>,
          document.body,
        )}
      {dialogs}
      {spreadDialog}
    </>
  );
}

const CategoryPanel = memo(function CategoryPanel({
  category,
  categoryIndex,
  playingId,
  onPlay,
  selectedBroadcastId,
  onSelectBroadcast,
  onReelExit,
  reelResume,
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
  onReelExit: (broadcast: CategoryBroadcast, resume: boolean, time: number) => void;
  reelResume: { id: string; time: number } | null;
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
  const [spreadBroadcast, setSpreadBroadcast] = useState<CategoryBroadcast | null>(null);
  const [hoveredBroadcastId, setHoveredBroadcastId] = useState<string | null>(null);
  const loadMarkerRef = useRef<HTMLDivElement>(null);
  const expandedBroadcastRef = useRef<HTMLDivElement>(null);
  const categoryStyle = {
    '--category-accent': category.accent,
  } as CSSProperties;

  useEffect(() => {
    if (!hasMore) return;

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
  }, [category.name, hasMore, loadedCount, onLoadMore]);

  useEffect(() => {
    if (!selectedBroadcastId) return;

    expandedBroadcastRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedBroadcastId]);

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

        <div className="category-market-list category-position-list">
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
                    playingId={playingId}
                    onPlay={onPlay}
                    loadThumbnail
                    dropId={dropIdsByRank[broadcast.rank] ?? null}
                    reelBroadcasts={broadcasts}
                    onReelExit={onReelExit}
                    initialPlaybackTime={reelResume?.id === broadcast.id ? reelResume.time : 0}
                    useSharedDemoVideo
                    accentColor={category.accent}
                  />
                </div>
              );
            }

            return (
              <div
                className="category-position-item"
                key={broadcast.id}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse' && window.innerWidth > 680) {
                    setHoveredBroadcastId(broadcast.id);
                  }
                }}
                onPointerLeave={() => {
                  if (!document.querySelector('.category-action-dialog[aria-labelledby^="dm-title"], .category-lead-card.is-video-fullscreen')) {
                    setHoveredBroadcastId(null);
                  }
                }}
              >
                {hoveredBroadcastId === broadcast.id ? (
                  <div className="category-position-preview">
                    <BroadcastVideoCard
                      broadcast={broadcast}
                      playingId={null}
                      onPlay={(id) => { onSelectBroadcast(id); onPlay(id); }}
                      loadThumbnail
                      dropId={dropIdsByRank[broadcast.rank] ?? null}
                      reelBroadcasts={broadcasts}
                      onReelExit={onReelExit}
                      useSharedDemoVideo
                      thumbnailPreview
                      onPreviewSpread={setSpreadBroadcast}
                      onPreviewSelect={(preview) => onSelectBroadcast(preview.id)}
                      accentColor={category.accent}
                    />
                  </div>
                ) : (
                  <>
                <button
                  className="category-position-row"
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
                <button
                  className="category-position-spread"
                  type="button"
                  aria-label={`Spread position #${broadcast.rank}: ${broadcast.title}`}
                  onClick={() => setSpreadBroadcast(broadcast)}
                >
                  <Share2 size={15} aria-hidden="true" />
                  <span>SPREAD IT</span>
                </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div
            ref={loadMarkerRef}
            className="category-market-view-more"
            aria-hidden="true"
          />
        )}
        {spreadBroadcast && (
          <SpreadPositionDialog
            broadcast={spreadBroadcast}
            onClose={() => { setSpreadBroadcast(null); setHoveredBroadcastId(null); }}
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
  const [featuredBroadcastId, setFeaturedBroadcastId] = useState<string | null>(
    null,
  );
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [reelResume, setReelResume] = useState<{ id: string; time: number } | null>(null);
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
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get('category')?.toUpperCase();
    const requestedIndex = categories.findIndex(
      (category) => category.name === requestedCategory,
    );
    const selectedIndex = requestedIndex >= 0 ? requestedIndex : 0;
    const requestedBroadcast = params.get('broadcast');
    const matchingBroadcast = categoryBroadcasts[selectedIndex].find(({ id }) => id === requestedBroadcast);
    if (requestedIndex <= 0 && !matchingBroadcast) return;
    const frame = window.requestAnimationFrame(() => {
      activeIndexRef.current = selectedIndex;
      setActiveIndex(selectedIndex);
      if (matchingBroadcast) {
        setFeaturedBroadcastId(matchingBroadcast.id);
        setVisibleCounts((current) => ({ ...current, [categories[selectedIndex].name]: Math.max(current[categories[selectedIndex].name] ?? initialBroadcastCount, matchingBroadcast.rank) }));
      }
      scrollToCategory(selectedIndex, 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToCategory]);

  useEffect(() => {
    tabRefs.current[categoryTabIndices.indexOf(activeIndex)]?.scrollIntoView({
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
    setReelResume(null);
    scrollToCategory(nextIndex, 'auto');
  }

  const toggleBroadcast = useCallback((id: string) => {
    setPlayingId((current) => (current === id ? null : id));
  }, []);

  const selectBroadcast = useCallback((id: string) => {
    setFeaturedBroadcastId(id);
    setPlayingId(null);
    setReelResume(null);
  }, []);

  const exitReel = useCallback((broadcast: CategoryBroadcast, resume: boolean, time: number) => {
    setFeaturedBroadcastId(broadcast.id);
    setPlayingId(resume ? broadcast.id : null);
    setReelResume(resume ? { id: broadcast.id, time } : null);
    const categoryName = categories[activeIndexRef.current].name;
    setVisibleCounts((current) => ({
      ...current,
      [categoryName]: Math.max(current[categoryName] ?? initialBroadcastCount, broadcast.rank),
    }));
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
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const currentTabIndex = categoryTabIndices.indexOf(activeIndexRef.current);
    const nextTabIndex =
      currentTabIndex + (event.key === 'ArrowRight' ? 1 : -1);
    if (nextTabIndex < 0 || nextTabIndex >= categoryTabIndices.length) return;
    selectCategory(categoryTabIndices[nextTabIndex]);
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
      setReelResume(null);
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
          <div
            className="homepage-category-list"
            role="tablist"
            aria-label="Market categories"
          >
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
            {categoryTabIndices.slice(1).map((categoryIndex, tabIndex) => {
              const category = categories[categoryIndex];
              const isTrending = categoryIndex === trendingCategoryIndex;
              const Icon = isTrending ? Flame : category.icon;
              return (
                <button
                  ref={(element) => {
                    tabRefs.current[tabIndex + 1] = element;
                  }}
                  className={`homepage-category-option ${activeIndex === categoryIndex ? 'is-active' : ''} ${isTrending ? 'is-trending' : ''}`}
                  key={category.name}
                  type="button"
                  role="tab"
                  aria-selected={activeIndex === categoryIndex}
                  aria-label={`${isTrending ? 'Trending category ' : ''}${category.name}, ${category.liveCount} bids`}
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
                      TRENDING
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
                    onReelExit={exitReel}
                    reelResume={reelResume}
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
