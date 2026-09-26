'use client';

import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Check,
  CircleHelp,
  Copy,
  DollarSign,
  Eye,
  FileText,
  Flame,
  Gavel,
  Megaphone,
  MessageCircle,
  Mic,
  Radio,
  RotateCcw,
  Send,
  Share2,
  Store,
  Undo2,
  UsersRound,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
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

export function BroadcastVideoCard({
  broadcast,
  playingId,
  onPlay,
  loadThumbnail,
  dropId,
  useSharedDemoVideo = false,
  accentColor,
}: {
  broadcast: CategoryBroadcast;
  playingId: string | null;
  onPlay: (id: string) => void;
  loadThumbnail: boolean;
  dropId: string | null;
  useSharedDemoVideo?: boolean;
  accentColor?: string;
}) {
  const { session } = useBought();
  const isPlaying = playingId === broadcast.id;
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null);
  const [opinions, setOpinions] = useState<Array<{ text: string; stance: 'agree' | 'disagree' }>>([]);
  const [opinionStep, setOpinionStep] = useState(0);
  const [opinionDraft, setOpinionDraft] = useState('');
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isSpreadOpen, setIsSpreadOpen] = useState(false);
  const [spreadCopied, setSpreadCopied] = useState(false);
  const [spreadError, setSpreadError] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const hasLocalDemo = useSharedDemoVideo || broadcast.rank === 1;
  const canPlay = hasLocalDemo || Boolean(dropId);
  const showFloatingPlayer = isPlaying && mediaPlaying && isDocked;
  const handleMediaAspectChange = useCallback((width: number, height: number) => {
    const nextRatio = portraitVideoAspectRatio(width, height);
    setMediaAspectRatio((current) =>
      nextRatio !== null && current !== null && Math.abs(current - nextRatio) < 0.001
        ? current
        : nextRatio,
    );
  }, []);

  const pauseBroadcast = () => {
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
    if (!isPlaying) return;

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
      setIsDocked(mediaPlaying && rect.bottom <= 0);
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
  }, [isPlaying, mediaAspectRatio, mediaPlaying]);

  function seekVideo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;

    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    video.currentTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      duration,
    );
  }

  function startOver() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
  }

  function toggleMute() {
    const video = videoRef.current;
    const nextMuted = video ? !video.muted : !isMuted;
    if (video) video.muted = nextMuted;
    setIsMuted(nextMuted);
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

  const spreadUrl = () => {
    const url = new URL('/categories', window.location.origin);
    url.searchParams.set('category', broadcast.id.startsWith('ALL-') ? 'ALL' : broadcast.categoryName);
    url.searchParams.set('broadcast', broadcast.id);
    return url.toString();
  };

  async function copySpreadLink() {
    try {
      await navigator.clipboard.writeText(spreadUrl());
      setSpreadCopied(true);
      setSpreadError('');
    } catch {
      setSpreadError('Could not copy automatically. Select the link below to copy it.');
    }
  }

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
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (!isMessageOpen && !isSpreadOpen) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMessageOpen(false);
        setIsSpreadOpen(false);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMessageOpen, isSpreadOpen]);

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current === null) return;
    window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = null;
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearControlsTimer();
    if (isPlaying)
      controlsTimerRef.current = window.setTimeout(
        () => setControlsVisible(false),
        2400,
      );
  }, [clearControlsTimer, isPlaying]);

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

    if (isPlaying) {
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
  }, [hasLocalDemo, isPlaying]);

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
      className={`category-lead-card category-broadcast-video ${mediaAspectRatio ? 'is-portrait-video' : ''} ${isPlaying ? 'is-playing is-player-portaled' : ''} ${mediaPlaying ? 'is-media-playing' : ''} ${mediaPlaying && !controlsVisible ? 'controls-hidden' : ''} ${showFloatingPlayer ? 'is-docked' : ''}`}
      style={cardStyle}
    >
      <div
        className="category-lead-media"
        onPointerDown={revealControls}
        onPointerMove={revealControls}
      >
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
              onLoadedMetadata={(event) =>
                handleMediaAspectChange(
                  event.currentTarget.videoWidth,
                  event.currentTarget.videoHeight,
                )
              }
              onPlaying={() => setMediaPlaying(true)}
              onPause={() => setMediaPlaying(false)}
              onEnded={() => {
                setMediaPlaying(false);
                setIsDocked(false);
                onPlay(broadcast.id);
              }}
              onVolumeChange={() => setIsMuted(videoRef.current?.muted ?? false)}
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
              dropId={dropId}
              onPlayingChange={setMediaPlaying}
              onAspectRatioChange={handleMediaAspectChange}
            />
          </div>
        )}
        <span className="category-lead-shade" aria-hidden="true" />
        <button
          className="category-lead-mic"
          type="button"
          disabled={!canPlay}
          tabIndex={mediaPlaying && !controlsVisible ? -1 : 0}
          onClick={() => {
            if (!canPlay) return;
            if (!isPlaying) onPlay(broadcast.id);
            else if (mediaPlaying) pauseBroadcast();
            else resumeBroadcast();
          }}
          aria-label={
            canPlay
              ? `${isPlaying && mediaPlaying ? 'Pause' : 'Play'} ${broadcast.name}'s broadcast`
              : `${broadcast.name}'s broadcast is not ready to play`
          }
        >
          <Mic size={25} strokeWidth={1.8} aria-hidden="true" />
        </button>
        {mediaPlaying && hasLocalDemo && (
          <div className="category-video-seek-controls" aria-label="Seek video">
            <button
              className="category-video-seek-control"
              type="button"
              onClick={() => seekVideo(-10)}
              tabIndex={controlsVisible ? 0 : -1}
              aria-label="Back 10 seconds"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span>10</span>
            </button>
            <button
              className="category-video-seek-control"
              type="button"
              onClick={() => seekVideo(10)}
              tabIndex={controlsVisible ? 0 : -1}
              aria-label="Forward 10 seconds"
            >
              <span>10</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
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
          {mediaPlaying && (
            <>
              <button
                className="category-lead-control category-lead-startover"
                type="button"
                disabled={!hasLocalDemo}
                tabIndex={controlsVisible ? 0 : -1}
                onClick={startOver}
                aria-label="Start broadcast over"
              >
                <RotateCcw size={15} aria-hidden="true" />
              </button>
              <button
                className="category-lead-control category-lead-sound"
                type="button"
                disabled={!hasLocalDemo}
                tabIndex={controlsVisible ? 0 : -1}
                aria-pressed={isMuted}
                onClick={toggleMute}
                aria-label={isMuted ? 'Turn on video sound' : 'Mute video'}
              >
                {isMuted ? (
                  <VolumeX size={16} aria-hidden="true" />
                ) : (
                  <Volume2 size={16} aria-hidden="true" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="category-lead-content">
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
                onClick={() => { setIsSpreadOpen(true); setSpreadCopied(false); setSpreadError(''); }}
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

  const dialogs = typeof document !== 'undefined' && (isMessageOpen || isSpreadOpen)
    ? createPortal(
        <div className="category-action-backdrop">
          {isMessageOpen ? (
            <dialog open className="category-action-dialog" aria-modal="true" aria-labelledby={`dm-title-${broadcast.id}`}>
              <div className="category-action-head">
                <div>
                  <small>DIRECT MESSAGE</small>
                  <h2 id={`dm-title-${broadcast.id}`}>Say something to {broadcast.name}</h2>
                </div>
                <button type="button" onClick={() => setIsMessageOpen(false)} aria-label="Close message dialog"><X size={18} /></button>
              </div>
              <form className="category-action-form" onSubmit={submitMessage}>
                <label htmlFor={`message-${broadcast.id}`}>Your message</label>
                <textarea
                  id={`message-${broadcast.id}`}
                  autoFocus
                  value={messageDraft}
                  onChange={(event) => { setMessageDraft(event.target.value); setMessageError(''); }}
                  placeholder={`Message ${broadcast.name} directly...`}
                  maxLength={240}
                  rows={4}
                />
                <small>Opens in your DM page after sending.</small>
                {messageError && <p className="category-action-error" role="alert">{messageError}</p>}
                <button className="category-action-primary" type="submit" disabled={!messageDraft.trim()}><Send size={15} /> Send message</button>
              </form>
            </dialog>
          ) : (
            <dialog open className="category-action-dialog" aria-modal="true" aria-labelledby={`spread-title-${broadcast.id}`}>
              <div className="category-action-head">
                <div>
                  <small>SPREAD THIS BROADCAST</small>
                  <h2 id={`spread-title-${broadcast.id}`}>Spread this position</h2>
                </div>
                <button type="button" onClick={() => setIsSpreadOpen(false)} aria-label="Close spread dialog"><X size={18} /></button>
              </div>
              <p className="category-action-description">Send a direct link to {broadcast.name}&apos;s position.</p>
              <div className="category-action-copy">
                <input readOnly aria-label="Broadcast link" value={spreadUrl()} onFocus={(event) => event.currentTarget.select()} />
                <button type="button" onClick={copySpreadLink}>{spreadCopied ? <Check size={16} /> : <Copy size={16} />}{spreadCopied ? 'Copied' : 'Copy link'}</button>
              </div>
              {spreadError && <p className="category-action-error" role="alert">{spreadError}</p>}
            </dialog>
          )}
        </div>,
        document.body,
      )
    : null;

  if (!isPlaying) return <>{card}{dialogs}</>;

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
          <div className={`market-shell dashboard-shell broadcast-floating-root ${showFloatingPlayer ? 'is-docked' : ''}`}>
            {card}
          </div>,
          document.body,
        )}
      {dialogs}
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
                    useSharedDemoVideo
                    accentColor={category.accent}
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
