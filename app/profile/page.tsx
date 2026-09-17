'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardPaste,
  Edit3,
  Eye,
  Link2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Radio,
  Share2,
  Trash2,
  X as CloseIcon,
  UserRound,
  Video,
} from 'lucide-react';
import Link from 'next/link';

import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';
import {
  InstagramBrandIcon,
  LinkedInBrandIcon,
  TikTokBrandIcon,
  XBrandIcon,
  YouTubeBrandIcon,
  type SocialBrandIcon,
} from '@/components/social-brand-icons';
import { useBought } from '@/components/bought-provider';
import {
  DEV_TEST_AUTH_STORAGE_KEY,
  DEV_TEST_PROFILE_STORAGE_KEY,
  isDevAuthTestMode,
} from '@/lib/dev-auth';
import {
  parseSocialAvatarUrl,
  socialAvatarImageUrl,
} from '@/lib/social-avatar';

type ProfileType = 'Individual' | 'Company' | 'Creator' | 'Investor' | 'Other';
type SocialLinkKey =
  | 'x'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'website';
type SocialLinks = Record<SocialLinkKey, string>;

type ProfileBroadcast = {
  id: string;
  title: string;
  category: string;
  state: string;
  amount_minor: number;
  created_at: string;
  thumbnail_path?: string;
};

type ProfileStats = {
  broadcasts: number;
  published: number;
  totalViews: number;
  topPositions: number;
};

type ProfileDraft = {
  avatarUrl: string;
  age: string;
  bio: string;
  fullName: string;
  username: string;
  socialLinks: SocialLinks;
  city: string;
  country: string;
  profileType: ProfileType;
};

const SOCIAL_LINK_FIELDS: Array<{
  key: SocialLinkKey;
  label: string;
  placeholder: string;
  icon: SocialBrandIcon;
}> = [
  {
    key: 'x',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/yourusername',
    icon: XBrandIcon,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourusername',
    icon: InstagramBrandIcon,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/yourusername',
    icon: LinkedInBrandIcon,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@yourusername',
    icon: YouTubeBrandIcon,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@yourusername',
    icon: TikTokBrandIcon,
  },
  {
    key: 'website',
    label: 'Website',
    placeholder: 'https://yourwebsite.com',
    icon: Link2,
  },
];

const PROFILE_TYPES: Array<{
  label: ProfileType;
  description: string;
  icon: typeof UserRound;
}> = [
  { label: 'Individual', description: 'Personal profile', icon: UserRound },
  { label: 'Company', description: 'Business or team', icon: Building2 },
  { label: 'Creator', description: 'Maker or publisher', icon: Video },
  { label: 'Investor', description: 'Backer or fund', icon: BarChart3 },
  { label: 'Other', description: 'Something else', icon: MoreHorizontal },
];

const CITY_OPTIONS = [
  'Bengaluru',
  'Mumbai',
  'New Delhi',
  'Hyderabad',
  'Chennai',
  'Pune',
  'London',
  'New York',
  'San Francisco',
  'Singapore',
  'Dubai',
  'Toronto',
];

const COUNTRY_OPTIONS = [
  'India',
  'United States',
  'United Kingdom',
  'Singapore',
  'United Arab Emirates',
  'Canada',
  'Australia',
  'Germany',
  'Japan',
];

function metadataValue(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function metadataProfileType(metadata: Record<string, unknown>): ProfileType {
  const value = metadataValue(metadata, 'profile_type', 'profile_kind', 'role');
  return PROFILE_TYPES.some((item) => item.label === value)
    ? (value as ProfileType)
    : 'Individual';
}

function emptySocialLinks(): SocialLinks {
  return {
    x: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    tiktok: '',
    website: '',
  };
}

function socialKeyFromUrl(url: string): SocialLinkKey {
  const value = url.toLowerCase();
  if (value.includes('instagram')) return 'instagram';
  if (value.includes('linkedin')) return 'linkedin';
  if (value.includes('youtube') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('tiktok')) return 'tiktok';
  if (value.includes('twitter') || value.includes('x.com')) return 'x';
  return 'website';
}

function socialLinksFromMetadata(metadata: Record<string, unknown>) {
  const links = emptySocialLinks();
  const storedLinks = metadata.social_links;
  if (
    storedLinks &&
    typeof storedLinks === 'object' &&
    !Array.isArray(storedLinks)
  ) {
    for (const field of SOCIAL_LINK_FIELDS) {
      const value = (storedLinks as Record<string, unknown>)[field.key];
      if (typeof value === 'string') links[field.key] = value.trim();
    }
  }

  const metadataKeys: Record<SocialLinkKey, string[]> = {
    x: ['x_url', 'x', 'twitter'],
    instagram: ['instagram_url', 'instagram'],
    linkedin: ['linkedin_url', 'linkedin'],
    youtube: ['youtube_url', 'youtube'],
    tiktok: ['tiktok_url', 'tiktok'],
    website: ['website_url', 'website'],
  };
  for (const field of SOCIAL_LINK_FIELDS) {
    if (!links[field.key])
      links[field.key] = metadataValue(metadata, ...metadataKeys[field.key]);
  }

  const legacyUrl = metadataValue(
    metadata,
    'social_profile_url',
    'social_url',
    'url',
  );
  if (legacyUrl && !Object.values(links).some(Boolean)) {
    links[socialKeyFromUrl(legacyUrl)] = legacyUrl;
  }
  return links;
}

function primarySocialUrl(links: SocialLinks) {
  return (
    SOCIAL_LINK_FIELDS.map((field) => links[field.key]).find(Boolean) ?? ''
  );
}

function profileDraft(
  metadata: Record<string, unknown>,
  email: string,
): ProfileDraft {
  const emailName = email.split('@')[0] || '';
  const location = metadataValue(metadata, 'location');
  const city = metadataValue(metadata, 'city') || location.split(',')[0].trim();
  const country =
    metadataValue(metadata, 'country') ||
    location.split(',').slice(1).join(',').trim();
  const rawHandle = metadataValue(metadata, 'username', 'handle') || emailName;

  return {
    avatarUrl: metadataValue(metadata, 'avatar_url', 'picture'),
    age: metadataValue(metadata, 'age'),
    bio: metadataValue(metadata, 'bio'),
    fullName: metadataValue(metadata, 'full_name', 'name'),
    username: rawHandle.replace(/^@/, ''),
    socialLinks: socialLinksFromMetadata(metadata),
    city,
    country,
    profileType: metadataProfileType(metadata),
  };
}

function compactAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error('That image could not be opened.'));
      image.onload = () => {
        const side = 320;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Your browser could not prepare that image.'));
          return;
        }
        const crop = Math.min(image.naturalWidth, image.naturalHeight);
        const offsetX = (image.naturalWidth - crop) / 2;
        const offsetY = (image.naturalHeight - crop) / 2;
        context.drawImage(
          image,
          offsetX,
          offsetY,
          crop,
          crop,
          0,
          0,
          side,
          side,
        );
        resolve(canvas.toDataURL('image/webp', 0.82));
      };
      if (typeof reader.result !== 'string') {
        reject(new Error('That image could not be read.'));
        return;
      }
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function withCurrentOption(options: string[], current: string) {
  return current && !options.includes(current)
    ? [current, ...options]
    : options;
}

function profileIsCreated(profile: ProfileDraft) {
  return Boolean(
    profile.fullName.trim() &&
    profile.username.trim() &&
    profile.city &&
    profile.country,
  );
}

function countFromMetadata(
  metadata: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = Number(metadata[key]);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

function displayCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}

function externalProfileHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function ProfileOverview({
  profile,
  stats,
  broadcasts,
  joinedAt,
  onEdit,
}: {
  profile: ProfileDraft;
  stats: ProfileStats;
  broadcasts: ProfileBroadcast[];
  joinedAt: string;
  onEdit: () => void;
}) {
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'value'>('recent');
  const initials =
    profile.fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BT';
  const connectedLinks = SOCIAL_LINK_FIELDS.filter(
    (field) => profile.socialLinks[field.key],
  );
  const joinedDate = new Date(joinedAt);
  const joinedLabel = Number.isNaN(joinedDate.getTime())
    ? 'Joined recently'
    : `Joined ${new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
      }).format(joinedDate)}`;
  const sortedBroadcasts = [...broadcasts].sort((left, right) => {
    if (sortBy === 'value') return right.amount_minor - left.amount_minor;
    const direction = sortBy === 'oldest' ? 1 : -1;
    return (
      direction *
      (new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime())
    );
  });

  async function shareProfile() {
    const shareData = {
      title: `${profile.fullName} on BOUGHT`,
      text: `View ${profile.fullName}'s BOUGHT profile.`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
      }
    } catch {
      // Closing the native share sheet is not an error the profile needs to show.
    }
  }

  return (
    <div className="profile-overview-page profile-showcase">
      <section className="profile-showcase-hero">
        <div className="profile-showcase-identity">
          <ProfileAvatar
            initials={initials}
            imageSrc={profile.avatarUrl}
            imageMode="cover"
            className="profile-showcase-avatar"
            alt={`${profile.fullName} profile image`}
          />
          <div className="profile-showcase-copy">
            <div className="profile-showcase-header-row">
              <div className="profile-showcase-name-row">
                <h1>{profile.fullName}</h1>
                <span title="Profile complete" aria-label="Profile complete">
                  <Check size={13} strokeWidth={3} />
                </span>
              </div>
              <div className="profile-showcase-actions">
                <button type="button" onClick={onEdit}>
                  <Edit3 size={17} /> Edit profile
                </button>
                <button
                  className="profile-showcase-share"
                  type="button"
                  onClick={() => void shareProfile()}
                  aria-label="Share profile"
                  title="Share profile"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            <div className="profile-showcase-meta">
              <span>@{profile.username}</span>
              {profile.age && <span>{profile.age}</span>}
              <span>
                <MapPin size={14} /> {profile.city}, {profile.country}
              </span>
              <span>{profile.profileType}</span>
            </div>

            <p className="profile-showcase-bio">
              {profile.bio ||
                `${profile.profileType} on BOUGHT. Sharing ideas, opinions, and attention.`}
            </p>

            <div className="profile-showcase-stats">
              <span>
                <Play size={17} />
                <strong>{displayCount(stats.broadcasts)}</strong> Broadcasts
              </span>
              <span>
                <Eye size={18} />
                <strong>{displayCount(stats.totalViews)}</strong> Total views
              </span>
              <span>
                <CalendarDays size={17} /> {joinedLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-showcase-socials">
          <h2>Socials</h2>
          {connectedLinks.length > 0 ? (
            <div className="profile-showcase-social-grid">
              {connectedLinks.map(({ key, label, icon: Icon }) => (
                <a
                  key={key}
                  href={externalProfileHref(profile.socialLinks[key])}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                >
                  <span className={`profile-social-icon is-${key}`}>
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <small>{label.replace(' (Twitter)', '')}</small>
                </a>
              ))}
            </div>
          ) : (
            <button
              className="profile-showcase-add-socials"
              type="button"
              onClick={onEdit}
            >
              <Plus size={16} /> Add social links
            </button>
          )}
        </div>
      </section>

      <section className="profile-showcase-broadcasts">
        <div className="profile-showcase-broadcast-heading">
          <h2>
            Your broadcasts <span>({stats.broadcasts})</span>
          </h2>
          <div>
            {broadcasts.length > 1 && (
              <label className="profile-showcase-sort">
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as typeof sortBy)
                  }
                  aria-label="Sort broadcasts"
                >
                  <option value="recent">Recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="value">Highest bid</option>
                </select>
                <ChevronDown size={15} />
              </label>
            )}
            {broadcasts.length > 0 && (
              <Link href="/broadcast" className="profile-showcase-create">
                <Radio size={16} /> Create broadcast
              </Link>
            )}
          </div>
        </div>

        {sortedBroadcasts.length > 0 ? (
          <div className="profile-showcase-broadcast-grid">
            {sortedBroadcasts.map((broadcast, index) => {
              const thumbnail = broadcast.thumbnail_path;
              const canDisplayThumbnail = Boolean(
                thumbnail && /^(https?:\/\/|data:image\/|\/)/.test(thumbnail),
              );
              return (
                <article className="profile-showcase-card" key={broadcast.id}>
                  <div
                    className={`profile-showcase-card-visual is-tone-${index % 4}`}
                    style={
                      canDisplayThumbnail
                        ? { backgroundImage: `url(${thumbnail})` }
                        : undefined
                    }
                  >
                    <span>{broadcast.category}</span>
                    <Radio size={30} aria-hidden="true" />
                    <small>{broadcast.state.replaceAll('_', ' ')}</small>
                  </div>
                  <div className="profile-showcase-card-copy">
                    <div>
                      <h3>{broadcast.title}</h3>
                      <span
                        className="profile-showcase-card-menu"
                        aria-hidden="true"
                      >
                        <MoreHorizontal size={18} />
                      </span>
                    </div>
                    <p>
                      {broadcast.category} <span>•</span>{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(broadcast.created_at))}
                    </p>
                    <footer>
                      <span>
                        <Eye size={15} /> {broadcast.state.replaceAll('_', ' ')}
                      </span>
                      <strong>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(broadcast.amount_minor / 100)}
                      </strong>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="profile-showcase-empty">
            <div className="profile-showcase-empty-kicker">
              <Radio size={12} /> Global ladder
            </div>
            <div className="profile-showcase-empty-content">
              <Video size={27} aria-hidden="true" />
              <h3>The floor is open.</h3>
              <p>
                The live ladder opens with the first verified, approved
                broadcasts.
              </p>
              <Link href="/broadcast">
                Make a broadcast <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileEditor({
  initial,
  onChange,
  onDone,
  isModal = false,
}: {
  initial: ProfileDraft;
  onChange: (profile: ProfileDraft) => void;
  onDone: (profile: ProfileDraft) => void;
  isModal?: boolean;
}) {
  const { client } = useBought();
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [error, setError] = useState('');
  const [fetchUrl, setFetchUrl] = useState(
    primarySocialUrl(initial.socialLinks),
  );
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(false);

  function update<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) {
    setDraft((before) => ({ ...before, [key]: value }));
    setError('');
  }

  function updateSocialLink(key: SocialLinkKey, value: string) {
    setDraft((before) => ({
      ...before,
      socialLinks: { ...before.socialLinks, [key]: value },
    }));
    setError('');
  }

  async function pasteInto(
    input: HTMLInputElement | null,
    onPaste: (value: string) => void,
  ) {
    input?.focus();
    try {
      const value = (await navigator.clipboard?.readText())?.trim();
      if (!value) return;
      onPaste(value);
      setError('');
    } catch {
      // Some embedded browsers do not expose clipboard contents to pages.
      // Keep the intended field focused without showing a disruptive error.
      setError('');
    }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG, or other image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Keep the profile image under 5MB.');
      return;
    }
    try {
      setError('');
      update('avatarUrl', await compactAvatar(file));
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : 'That image could not be prepared.',
      );
    }
  }

  async function fetchImage() {
    const value = fetchUrl.trim() || primarySocialUrl(draft.socialLinks);
    if (!value) {
      setError('Paste a social profile link first.');
      return;
    }
    setFetchingImage(true);
    setError('');
    try {
      const lookup = parseSocialAvatarUrl(value);
      const avatarUrl = socialAvatarImageUrl(lookup);
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => {
          image.src = '';
          reject(
            new Error(
              'The profile image lookup timed out. Upload one instead.',
            ),
          );
        }, 12000);
        image.onload = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        image.onerror = () => {
          window.clearTimeout(timeout);
          reject(
            new Error(
              'No public profile image was found. Private profiles must be uploaded.',
            ),
          );
        };
        image.src = avatarUrl;
      });
      setDraft((before) => ({
        ...before,
        avatarUrl,
        socialLinks: {
          ...before.socialLinks,
          [lookup.platform]: lookup.normalizedUrl,
        },
      }));
      setFetchUrl(lookup.normalizedUrl);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'That profile image could not be fetched.',
      );
    } finally {
      setFetchingImage(false);
    }
  }

  const persistProfile = useCallback(
    async (nextDraft: ProfileDraft) => {
      const fullName = nextDraft.fullName.trim();
      const username = nextDraft.username.trim();
      if (fullName.length < 2) return;
      if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) return;
      if (!nextDraft.city || !nextDraft.country) return;

      setError('');
      const socialLinks = Object.fromEntries(
        SOCIAL_LINK_FIELDS.map((field) => [
          field.key,
          nextDraft.socialLinks[field.key].trim(),
        ]),
      ) as SocialLinks;
      const profileData = {
        avatar_url: nextDraft.avatarUrl.trim(),
        full_name: fullName,
        username,
        social_profile_url: primarySocialUrl(socialLinks),
        social_links: socialLinks,
        x_url: socialLinks.x,
        instagram_url: socialLinks.instagram,
        linkedin_url: socialLinks.linkedin,
        youtube_url: socialLinks.youtube,
        tiktok_url: socialLinks.tiktok,
        website_url: socialLinks.website,
        city: nextDraft.city,
        country: nextDraft.country,
        location: [nextDraft.city, nextDraft.country]
          .filter(Boolean)
          .join(', '),
        profile_type: nextDraft.profileType,
        bio: nextDraft.bio.trim(),
        age: nextDraft.age.trim(),
        profile_completed: true,
        profile_updated_at: new Date().toISOString(),
      };

      try {
        if (!client) {
          if (
            isDevAuthTestMode() &&
            window.localStorage.getItem(DEV_TEST_AUTH_STORAGE_KEY) === '1'
          ) {
            window.localStorage.setItem(
              DEV_TEST_PROFILE_STORAGE_KEY,
              JSON.stringify(profileData),
            );
            return;
          }
          throw new Error('Your sign-in session is not ready yet.');
        }
        const { error: updateError } = await client.auth.updateUser({
          data: profileData,
        });
        if (updateError) throw updateError;
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Your profile could not be saved. Please try again.',
        );
      }
    },
    [client],
  );

  const queueSave = useCallback(
    (nextDraft: ProfileDraft) => {
      const nextSave = saveQueueRef.current.then(() =>
        persistProfile(nextDraft),
      );
      saveQueueRef.current = nextSave.catch(() => undefined);
      return nextSave;
    },
    [persistProfile],
  );

  useEffect(() => {
    onChange(draft);
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void queueSave(draft);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, queueSave]);

  const finishEditing = useCallback(async () => {
    if (!profileIsCreated(draft)) {
      setError('Add your name, username, city, and country to finish.');
      return;
    }
    await queueSave(draft);
    onDone(draft);
  }, [draft, onDone, queueSave]);

  useEffect(() => {
    if (!isModal) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') void finishEditing();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finishEditing, isModal]);

  const initials =
    draft.fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BT';
  const cityOptions = withCurrentOption(CITY_OPTIONS, draft.city);
  const countryOptions = withCurrentOption(COUNTRY_OPTIONS, draft.country);

  return (
    <div className="profile-settings-page profile-editor-reference">
      <form
        className="profile-settings-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="profile-editor-toolbar">
          <div>
            <h1 id="profile-editor-title">Edit profile</h1>
            <p>Update your profile information and how you appear on BOUGHT.</p>
          </div>
          <div className="profile-editor-toolbar-actions">
            {isModal && (
              <button
                className="profile-editor-close"
                type="button"
                onClick={() => void finishEditing()}
                aria-label="Close edit profile"
              >
                <CloseIcon size={18} />
              </button>
            )}
            {!isModal && (
              <button type="button" onClick={() => void finishEditing()}>
                Finish profile
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="profile-editor-error" role="alert">
            {error}
          </div>
        )}
        <div className="profile-editor-workspace">
          <div className="profile-editor-fields">
            <section className="profile-settings-card profile-image-card">
              <div className="profile-editor-card-heading">
                <h2 className="profile-editor-section-title">Profile image</h2>
              </div>
              <div className="profile-image-layout">
                <div className="profile-upload-column">
                  <div
                    className={`profile-upload-box ${draft.avatarUrl ? 'has-image' : 'is-empty'}`}
                  >
                    <input
                      id="profile-avatar-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={chooseAvatar}
                    />
                    <ProfileAvatar
                      initials={initials}
                      imageSrc={draft.avatarUrl}
                      imageMode="cover"
                      className="profile-upload-preview"
                      alt="Selected profile image"
                    />
                    <div className="profile-upload-hover">
                      <div className="profile-upload-actions">
                        <label
                          className="profile-upload-action"
                          htmlFor="profile-avatar-file"
                          title={draft.avatarUrl ? 'Change photo' : 'Add photo'}
                          aria-label={
                            draft.avatarUrl ? 'Change photo' : 'Add photo'
                          }
                        >
                          {draft.avatarUrl ? (
                            <Pencil size={16} />
                          ) : (
                            <Plus size={17} />
                          )}
                        </label>
                        {draft.avatarUrl && (
                          <button
                            className="profile-upload-action is-danger"
                            type="button"
                            onClick={() => update('avatarUrl', '')}
                            title="Delete photo"
                            aria-label="Delete photo"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <label
                    className="profile-upload-button"
                    htmlFor="profile-avatar-file"
                  >
                    <Plus size={15} /> Upload photo
                  </label>
                  <small>JPG, PNG or WEBP · Max 5MB</small>
                </div>

                <div className="profile-image-divider" aria-hidden="true">
                  <span />
                  <b>OR</b>
                  <span />
                </div>

                <div className="profile-fetch-column">
                  <div className="profile-fetch-heading">
                    <span>
                      <Link2 size={19} />
                    </span>
                    <div>
                      <strong>Fetch from social media</strong>
                      <small>
                        Paste a public profile link and we’ll fetch the photo.
                      </small>
                    </div>
                  </div>
                  <div className="profile-fetch-row">
                    <label className="profile-inline-input">
                      <input
                        type="url"
                        value={fetchUrl}
                        onChange={(event) => setFetchUrl(event.target.value)}
                        placeholder="https://instagram.com/username"
                        aria-label="Social profile link for profile image"
                      />
                    </label>
                    <button
                      className="profile-paste-button"
                      type="button"
                      onClick={(event) =>
                        void pasteInto(
                          event.currentTarget.parentElement?.querySelector(
                            'input',
                          ) ?? null,
                          setFetchUrl,
                        )
                      }
                    >
                      <ClipboardPaste size={15} /> Paste
                    </button>
                    <button
                      className="profile-fetch-button"
                      type="button"
                      onClick={fetchImage}
                      disabled={fetchingImage}
                    >
                      {fetchingImage ? 'Fetching…' : 'Fetch photo'}
                    </button>
                  </div>
                  <div
                    className="profile-fetch-sources"
                    aria-label="Supported social profiles"
                  >
                    {SOCIAL_LINK_FIELDS.map(({ key, label, icon: Icon }) => (
                      <span
                        className={`profile-social-icon is-${key}`}
                        title={label}
                        key={key}
                      >
                        <Icon size={17} aria-hidden="true" />
                      </span>
                    ))}
                  </div>
                  <small className="profile-helper-text">
                    Public profiles only. Private or restricted profiles must be
                    uploaded from your files.
                  </small>
                </div>
              </div>
            </section>

            <section className="profile-settings-card">
              <div className="profile-editor-card-heading">
                <h2 className="profile-editor-section-title">
                  Profile details
                </h2>
              </div>
              <div className="profile-form-grid profile-details-grid">
                <label className="profile-settings-field">
                  <span>Display name</span>
                  <input
                    autoComplete="name"
                    value={draft.fullName}
                    onChange={(event) => update('fullName', event.target.value)}
                    placeholder="Your name"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="profile-settings-field">
                  <span>Username</span>
                  <input
                    autoComplete="username"
                    value={draft.username}
                    onChange={(event) =>
                      update('username', event.target.value.replace(/^@/, ''))
                    }
                    placeholder="username"
                    maxLength={32}
                    required
                  />
                </label>
                <label className="profile-settings-field profile-bio-field">
                  <span>Short bio / About</span>
                  <textarea
                    value={draft.bio}
                    onChange={(event) => update('bio', event.target.value)}
                    placeholder="Tell the community about yourself…"
                    maxLength={160}
                  />
                  <small>{draft.bio.length}/160</small>
                </label>
                <label className="profile-settings-field">
                  <span>City</span>
                  <div className="profile-select-wrap">
                    <select
                      autoComplete="address-level2"
                      value={draft.city}
                      onChange={(event) => update('city', event.target.value)}
                      required
                    >
                      <option value="">Choose a city</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={17} />
                  </div>
                </label>
                <label className="profile-settings-field">
                  <span>Country</span>
                  <div className="profile-select-wrap">
                    <select
                      autoComplete="country-name"
                      value={draft.country}
                      onChange={(event) =>
                        update('country', event.target.value)
                      }
                      required
                    >
                      <option value="">Choose a country</option>
                      {countryOptions.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={17} />
                  </div>
                </label>
              </div>
            </section>

            <section className="profile-settings-card profile-social-links-card">
              <div className="profile-editor-card-heading">
                <h2 className="profile-editor-section-title">Social links</h2>
                <p>Add your social profiles to help people find you.</p>
              </div>
              <div className="profile-social-links-list">
                {SOCIAL_LINK_FIELDS.map(
                  ({ key, label, placeholder, icon: Icon }) => (
                    <div className="profile-social-row" key={key}>
                      <span className="profile-social-platform" title={label}>
                        <span className={`profile-social-icon is-${key}`}>
                          <Icon size={17} strokeWidth={2} aria-hidden="true" />
                        </span>
                        <b>{label}</b>
                      </span>
                      <span className="profile-social-entry">
                        <input
                          type="url"
                          value={draft.socialLinks[key]}
                          onChange={(event) =>
                            updateSocialLink(key, event.target.value)
                          }
                          placeholder={placeholder}
                          aria-label={`${label} profile link`}
                        />
                        <button
                          className="profile-paste-button"
                          type="button"
                          onClick={(event) =>
                            void pasteInto(
                              event.currentTarget.parentElement?.querySelector(
                                'input',
                              ) ?? null,
                              (value) => updateSocialLink(key, value),
                            )
                          }
                        >
                          <ClipboardPaste size={14} /> Paste
                        </button>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="profile-settings-card profile-type-card">
              <div className="profile-editor-card-heading">
                <h2 className="profile-editor-section-title">
                  What best describes you?
                </h2>
              </div>
              <div className="profile-type-options">
                {PROFILE_TYPES.map(({ label, description, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className={`profile-type-option ${draft.profileType === label ? 'is-selected' : ''}`}
                    onClick={() => update('profileType', label)}
                    aria-pressed={draft.profileType === label}
                  >
                    <Icon size={20} />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    {draft.profileType === label && <Check size={16} />}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}

function ProfileExperience({
  metadata,
  email,
  joinedAt,
}: {
  metadata: Record<string, unknown>;
  email: string;
  joinedAt: string;
}) {
  const { api, client } = useBought();
  const initial = profileDraft(metadata, email);
  const hasExistingProfile = profileIsCreated(initial);
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(() => !hasExistingProfile);
  const [broadcasts, setBroadcasts] = useState<ProfileBroadcast[]>([]);

  useEffect(() => {
    if (!hasExistingProfile || !editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editing, hasExistingProfile]);

  useEffect(() => {
    let active = true;
    if (!client)
      return () => {
        active = false;
      };
    void api<{ drops: ProfileBroadcast[] }>('drops')
      .then(({ drops }) => {
        if (active) setBroadcasts(drops);
      })
      .catch(() => {
        if (active) setBroadcasts([]);
      });
    return () => {
      active = false;
    };
  }, [api, client]);

  const updateProfile = useCallback((next: ProfileDraft) => {
    setProfile(next);
  }, []);
  const finishEditing = useCallback((next: ProfileDraft) => {
    setProfile(next);
    setEditing(false);
  }, []);
  const published = broadcasts.filter(
    ({ state }) => state === 'published',
  ).length;
  const stats: ProfileStats = {
    broadcasts: Math.max(
      broadcasts.length,
      countFromMetadata(metadata, 'broadcast_count', 'broadcasts'),
    ),
    published: Math.max(
      published,
      countFromMetadata(
        metadata,
        'published_broadcast_count',
        'published_broadcasts',
      ),
    ),
    totalViews: countFromMetadata(metadata, 'total_views', 'broadcast_views'),
    topPositions: countFromMetadata(
      metadata,
      'top_positions',
      'position_count',
    ),
  };

  return (
    <MarketPageShell
      active="profile"
      eyebrow="PROFILE"
      title="Profile"
      description=""
      showIntro={false}
    >
      {!hasExistingProfile ? (
        <ProfileEditor
          initial={profile}
          onChange={updateProfile}
          onDone={finishEditing}
        />
      ) : (
        <>
          <ProfileOverview
            profile={profile}
            stats={stats}
            broadcasts={broadcasts}
            joinedAt={joinedAt}
            onEdit={() => setEditing(true)}
          />
          {editing && (
            <div className="profile-editor-modal-backdrop" role="presentation">
              <dialog
                className="profile-editor-modal"
                open
                aria-labelledby="profile-editor-title"
              >
                <ProfileEditor
                  initial={profile}
                  onChange={updateProfile}
                  onDone={finishEditing}
                  isModal
                />
              </dialog>
            </div>
          )}
        </>
      )}
    </MarketPageShell>
  );
}

export default function ProfilePage() {
  const { session, authReady } = useBought();

  useEffect(() => {
    if (authReady && !session) window.location.replace('/');
  }, [authReady, session]);

  if (!session) return null;

  return (
    <ProfileExperience
      metadata={session.user.user_metadata as Record<string, unknown>}
      email={session.user.email ?? ''}
      joinedAt={session.user.created_at}
    />
  );
}
