'use client';

import Link from '@/components/site-link';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  CalendarDays,
  Compass,
  Eye,
  EyeOff,
  Gamepad2,
  Globe2,
  GraduationCap,
  Handshake,
  ImagePlus,
  Lightbulb,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Radio,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  UserRoundPlus,
  UsersRound,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ChangeEvent, type SyntheticEvent } from 'react';

import { DropSignIn } from '@/components/drop-sign-in';
import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useBought } from '@/components/bought-provider';
import { CATEGORIES } from '@/lib/drop-domain';

const featuredBroadcasts = [
  {
    title: 'I switched from Notion to Anytype. Here’s why.',
    category: 'WHY I SWITCHED',
    amount: '$9,200',
    views: '12.4K',
    duration: '01:36',
  },
  {
    title: 'We spent $50,000 on LinkedIn ads. Here are the results.',
    category: 'SHOW THE RECEIPTS',
    amount: '$7,800',
    views: '9.8K',
    duration: '02:12',
  },
  {
    title: 'Roast my landing page. Be brutal.',
    category: 'TEARDOWN',
    amount: '$5,900',
    views: '8.2K',
    duration: '02:05',
  },
];

const publicActivity = [
  ['BROADCAST PUBLISHED', 'Your latest broadcast is live on today’s floor.', '2H AGO'],
  ['POSITION MOVED', 'You moved up in UNPOPULAR OPINION.', '5H AGO'],
  ['BID CONFIRMED', 'Your $9,200 position is secured for this cycle.', '1D AGO'],
];

function metadataValue(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function compactAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That image could not be opened.'));
      image.onload = () => {
        const side = 320;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Your browser could not prepare that image.'));
        const crop = Math.min(image.naturalWidth, image.naturalHeight);
        const offsetX = (image.naturalWidth - crop) / 2;
        const offsetY = (image.naturalHeight - crop) / 2;
        context.drawImage(image, offsetX, offsetY, crop, crop, 0, 0, side, side);
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

function metadataBoolean(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return value === true || value === 'true' || value === 1;
}

function metadataCategories(metadata: Record<string, unknown>) {
  const raw = metadata.preferred_categories ?? metadata.interests;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string =>
      typeof item === 'string' && (CATEGORIES as readonly string[]).includes(item),
  );
}

function metadataGoals(metadata: Record<string, unknown>) {
  const raw = metadata.profile_goals ?? metadata.goals;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string =>
      typeof item === 'string' && GOALS.some((goal) => goal.label === item),
  );
}

type ProfileDraft = {
  avatarUrl: string;
  age: string;
  country: string;
  city: string;
  goals: string[];
  categories: string[];
  fullName: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  x: string;
  linkedin: string;
  walletAddress: string;
  walletPublic: boolean;
};

function profileDraft(
  metadata: Record<string, unknown>,
  email: string,
): ProfileDraft {
  const emailName = email.split('@')[0] || '';
  const rawHandle = metadataValue(metadata, 'username', 'handle') || emailName;
  const location = metadataValue(metadata, 'location');
  const city = metadataValue(metadata, 'city') || location.split(',')[0].trim();
  const country =
    metadataValue(metadata, 'country') || location.split(',').slice(1).join(',').trim();
  return {
    avatarUrl: metadataValue(metadata, 'avatar_url', 'picture'),
    age: metadataValue(metadata, 'age'),
    country,
    city,
    goals: metadataGoals(metadata),
    categories: metadataCategories(metadata),
    fullName: metadataValue(metadata, 'full_name', 'name'),
    username: rawHandle.replace(/^@/, ''),
    bio: metadataValue(metadata, 'bio', 'description'),
    location: location || [city, country].filter(Boolean).join(', '),
    website: metadataValue(metadata, 'website', 'url'),
    x: metadataValue(metadata, 'x', 'twitter', 'twitter_username'),
    linkedin: metadataValue(metadata, 'linkedin', 'linkedin_url'),
    walletAddress: metadataValue(metadata, 'wallet_address', 'wallet'),
    walletPublic: metadataBoolean(metadata, 'wallet_public'),
  };
}

const previewProfile: ProfileDraft = {
  avatarUrl: '',
  age: '29',
  country: 'India',
  city: 'Bengaluru',
  goals: [
    'Discover interesting people',
    'Learn from real results',
    'Follow debates and opinions',
    'Just browse and be entertained',
  ],
  categories: ['BEEF', 'CONFESSIONS', 'BUILDING'],
  fullName: 'Ananya Rao',
  username: 'ananyabuilds',
  bio: 'Building in public. Backing ideas worth hearing.',
  location: 'Bengaluru, India',
  website: 'https://ananyabuilds.com',
  x: '@ananyabuilds',
  linkedin: '',
  walletAddress: '',
  walletPublic: false,
};

const GOALS: { label: string; description: string; icon: LucideIcon }[] = [
  {
    label: 'Discover interesting people',
    description: 'Follow builders, investors, creators and more.',
    icon: UsersRound,
  },
  {
    label: 'Find products and companies',
    description: 'Explore what people are building and buying.',
    icon: Building2,
  },
  {
    label: 'Follow business and startups',
    description: 'Stay updated on markets, trends and new ideas.',
    icon: TrendingUp,
  },
  {
    label: 'Learn from real results',
    description: "See what works. What doesn't. Real experiences.",
    icon: BarChart3,
  },
  {
    label: 'Find jobs and hiring opportunities',
    description: 'Discover roles and opportunities.',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Find customers',
    description: 'Connect with people who need what you build.',
    icon: UserRoundPlus,
  },
  {
    label: 'Find founders, partners, or collaborators',
    description: "Meet people to build what's next.",
    icon: Handshake,
  },
  {
    label: 'Follow debates and opinions',
    description: 'See different perspectives on what matters.',
    icon: MessageCircle,
  },
  {
    label: 'Discover new opportunities',
    description: 'Get early access to ideas, drops and more.',
    icon: Sparkles,
  },
  {
    label: 'Find investors or fundraising opportunities',
    description: 'Connect with capital and backers.',
    icon: Sprout,
  },
  {
    label: 'Discover creators and experts',
    description: 'Learn from industry experts and thought leaders.',
    icon: GraduationCap,
  },
  {
    label: 'Just browse and be entertained',
    description: 'Explore, watch and enjoy the community.',
    icon: Gamepad2,
  },
];

const setupSteps = [
  {
    key: 'goals',
    label: 'WHAT BRINGS YOU',
    title: 'What brings you to BOUGHT?',
    description: 'Help us personalize what you see first.',
  },
  {
    key: 'categories',
    label: 'CATEGORIES',
    title: 'Choose your categories.',
    description: 'Pick at least 3. This helps us personalize your feed.',
  },
  {
    key: 'identity',
    label: 'CREATE PROFILE',
    title: 'Create your profile.',
    description: 'Add the details people will see when they find your signal.',
  },
  {
    key: 'wallet',
    label: 'WALLET',
    title: 'Choose your wallet signal.',
    description: 'Keep your wallet private or show the proof. Your call.',
  },
] as const;

type SetupStep = (typeof setupSteps)[number]['key'];

function ProfileSetup({
  initial,
  onComplete,
  previewOnly = false,
}: {
  initial: ProfileDraft;
  onComplete: () => void;
  previewOnly?: boolean;
}) {
  const { client } = useBought();
  const [step, setStep] = useState<SetupStep>('goals');
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stepIndex = setupSteps.findIndex((item) => item.key === step);
  const current = setupSteps[stepIndex];

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((valueBefore) => ({ ...valueBefore, [key]: value }));
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for your profile photo.');
      return;
    }
    try {
      setError('');
      update('avatarUrl', await compactAvatar(file));
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : 'That image could not be prepared. Please try another one.',
      );
    }
  }

  function continueSetup(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 'goals' && draft.goals.length === 0) {
      return setError('Choose at least one reason so we know what to surface first.');
    }
    if (step === 'categories' && draft.categories.length < 3) {
      return setError('Pick at least 3 categories so we can tune your feed.');
    }
    if (step === 'identity') {
      if (draft.fullName.trim().length < 2)
        return setError('Add the name you want the world to see.');
      if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(draft.username.trim()))
        return setError('Use a handle with 2–32 letters, numbers, dots, dashes, or underscores.');
      const age = Number(draft.age);
      if (!Number.isInteger(age) || age < 13 || age > 120)
        return setError('Add an age between 13 and 120.');
      if (!draft.country.trim()) return setError('Add the country you call home.');
      if (!draft.city.trim()) return setError('Add the city you call home.');
    }
    if (stepIndex < setupSteps.length - 1) {
      setStep(setupSteps[stepIndex + 1].key);
      return;
    }
    if (previewOnly) {
      onComplete();
      return;
    }
    void saveProfile();
  }

  async function saveProfile() {
    if (!client || busy) return;
    setBusy(true);
    try {
      const { error: updateError } = await client.auth.updateUser({
        data: {
          avatar_url: draft.avatarUrl.trim(),
          age: draft.age.trim(),
          country: draft.country.trim(),
          city: draft.city.trim(),
          profile_goals: draft.goals,
          preferred_categories: draft.categories,
          full_name: draft.fullName.trim(),
          username: draft.username.trim(),
          bio: draft.bio.trim(),
          location: [draft.city.trim(), draft.country.trim()].filter(Boolean).join(', '),
          website: draft.website.trim(),
          x: draft.x.trim(),
          linkedin: draft.linkedin.trim(),
          wallet_address: draft.walletAddress.trim(),
          wallet_public: draft.walletPublic,
          profile_completed: true,
          profile_updated_at: new Date().toISOString(),
        },
      });
      if (updateError) throw updateError;
      onComplete();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Your profile could not be saved. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-setup-layout">
      <section className="profile-setup-panel route-panel">
        <div className="profile-setup-topline">
          <span className="eyebrow">
            <i /> PROFILE SETUP
          </span>
          <span className="profile-setup-topline-actions">
            {previewOnly && (
              <button
                type="button"
                className="profile-preview-exit"
                onClick={onComplete}
              >
                EXIT PREVIEW
              </button>
            )}
            STEP {stepIndex + 2} / 5
          </span>
        </div>
        <div className="profile-setup-steps" aria-label="Profile setup progress">
          {setupSteps.map((item, index) => (
            <div
              className={`profile-setup-step ${index <= stepIndex ? 'is-active' : ''} ${item.key === step ? 'is-current' : ''}`}
              key={item.key}
            >
              <span>{index < stepIndex ? <Check size={13} /> : `0${index + 1}`}</span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>

        <header className="profile-setup-heading">
          <span className="profile-kicker">{current.label}</span>
          <h2>{current.title}</h2>
          <p>{current.description}</p>
        </header>

        <form className="profile-setup-form" onSubmit={continueSetup}>
          {step === 'goals' && (
            <div className="profile-form-fields">
              <fieldset className="profile-category-picker profile-goal-picker">
                <legend>
                  WHAT I WANT TO SEE <span>SELECT AT LEAST ONE</span>
                </legend>
                <div className="profile-goal-grid">
                  {GOALS.map((goal) => {
                    const selected = draft.goals.includes(goal.label);
                    const GoalIcon = goal.icon;
                    return (
                      <button
                        key={goal.label}
                        type="button"
                        className={`profile-goal-option ${selected ? 'is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          update(
                            'goals',
                            selected
                              ? draft.goals.filter((item) => item !== goal.label)
                              : [...draft.goals, goal.label],
                          )
                        }
                      >
                        <span className="profile-goal-icon"><GoalIcon size={22} /></span>
                        <span className="profile-goal-copy">
                          <strong>{goal.label}</strong>
                          <small>{goal.description}</small>
                        </span>
                        <span className="profile-goal-toggle">
                          {selected ? <Check size={14} /> : '+'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="profile-setup-note profile-preference-note">
                  <Compass size={16} />
                  <span>Your choices tune what we surface first. You can change them later.</span>
                </div>
              </fieldset>
            </div>
          )}

          {step === 'categories' && (
            <div className="profile-form-fields">
              <fieldset className="profile-category-picker">
                <legend>
                  CATEGORIES I WANT TO SEE <span>PICK AT LEAST 3</span>
                </legend>
                <div className="profile-category-grid">
                  {CATEGORIES.map((category, index) => {
                    const selected = draft.categories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`profile-category-option ${selected ? 'is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          update(
                            'categories',
                            selected
                              ? draft.categories.filter((item) => item !== category)
                              : [...draft.categories, category],
                          )
                        }
                      >
                        <span className="profile-category-check">
                          {selected ? <Check size={14} /> : String(index + 1).padStart(2, '0')}
                        </span>
                        <strong>{category}</strong>
                        <small>{selected ? 'ON YOUR FLOOR' : 'ADD TO YOUR FEED'}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="profile-setup-note profile-preference-note">
                  <Compass size={16} />
                  <span>Your choices tune what we surface first. You can change them later.</span>
                </div>
              </fieldset>
            </div>
          )}

          {step === 'identity' && (
            <div className="profile-form-fields">
              <div className="profile-photo-field">
                <ProfileAvatar
                  initials={draft.fullName.slice(0, 2).toUpperCase() || 'BT'}
                  imageSrc={draft.avatarUrl || undefined}
                  imageMode="cover"
                  className="profile-avatar-medium"
                  alt="Profile photo preview"
                />
                <label className="profile-field">
                  <span><ImagePlus size={14} /> PROFILE PHOTO <span className="profile-field-optional">OPTIONAL</span></span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={chooseAvatar}
                  />
                  <input
                    type="url"
                    value={draft.avatarUrl}
                    onChange={(event) => update('avatarUrl', event.target.value)}
                    placeholder="Or paste a photo URL"
                  />
                  <small>We crop uploads square. Leave blank and BOUGHT will use your initials.</small>
                </label>
              </div>
              <div className="profile-form-grid">
                <label className="profile-field">
                  DISPLAY NAME
                  <input
                    autoComplete="name"
                    value={draft.fullName}
                    onChange={(event) => update('fullName', event.target.value)}
                    placeholder="Your name"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="profile-field">
                  PUBLIC HANDLE
                  <span className="profile-input-prefix">@<input
                    autoComplete="username"
                    value={draft.username}
                    onChange={(event) => update('username', event.target.value.replace(/^@/, ''))}
                    placeholder="yourhandle"
                    maxLength={32}
                    required
                  /></span>
                </label>
              </div>
              <div className="profile-form-grid">
                <label className="profile-field">
                  AGE
                  <input
                    type="number"
                    min={13}
                    max={120}
                    value={draft.age}
                    onChange={(event) => update('age', event.target.value)}
                    placeholder="29"
                    required
                  />
                </label>
                <label className="profile-field">
                  COUNTRY
                  <input
                    autoComplete="country-name"
                    value={draft.country}
                    onChange={(event) => update('country', event.target.value)}
                    placeholder="India"
                    maxLength={60}
                    required
                  />
                </label>
              </div>
              <label className="profile-field">
                CITY
                <input
                  autoComplete="address-level2"
                  value={draft.city}
                  onChange={(event) => update('city', event.target.value)}
                  placeholder="Bengaluru"
                  maxLength={60}
                  required
                />
              </label>
              <label className="profile-field">
                BIO
                <textarea
                  value={draft.bio}
                  onChange={(event) => update('bio', event.target.value)}
                  placeholder="What should people know before they hear you?"
                  maxLength={160}
                  rows={3}
                />
                <small>{draft.bio.length} / 160</small>
              </label>
              <div className="profile-create-links">
                <label className="profile-field">
                  WEBSITE <span className="profile-field-optional">OPTIONAL</span>
                  <input
                    type="url"
                    value={draft.website}
                    onChange={(event) => update('website', event.target.value)}
                    placeholder="https://your-site.com"
                  />
                </label>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    X PROFILE <span className="profile-field-optional">OPTIONAL</span>
                    <input
                      value={draft.x}
                      onChange={(event) => update('x', event.target.value)}
                      placeholder="@yourhandle"
                    />
                  </label>
                  <label className="profile-field">
                    LINKEDIN <span className="profile-field-optional">OPTIONAL</span>
                    <input
                      value={draft.linkedin}
                      onChange={(event) => update('linkedin', event.target.value)}
                      placeholder="linkedin.com/in/yourname"
                    />
                  </label>
                </div>
                <div className="profile-setup-note">
                  <Globe2 size={16} />
                  <span>These links are optional. Add them now or edit them anytime from your profile.</span>
                </div>
              </div>
            </div>
          )}

          {step === 'wallet' && (
            <div className="profile-form-fields">
              <label className="profile-field">
                PUBLIC WALLET ADDRESS <span className="profile-field-optional">OPTIONAL</span>
                <input
                  value={draft.walletAddress}
                  onChange={(event) => update('walletAddress', event.target.value)}
                  placeholder="Wallet address or public wallet name"
                />
              </label>
              <div className="profile-wallet-option">
                <div>
                  <strong>Show wallet signal on my profile</strong>
                  <span>People can see your BOUGHT wallet signal and backing power.</span>
                </div>
                <button
                  type="button"
                  className={`profile-switch ${draft.walletPublic ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={draft.walletPublic}
                  aria-label="Show wallet signal on my profile"
                  onClick={() => update('walletPublic', !draft.walletPublic)}
                >
                  <span />
                </button>
              </div>
              <div className="profile-setup-note profile-setup-note-warn">
                <EyeOff size={16} />
                <span>Never enter a seed phrase or private key. BOUGHT only needs a public address or handle.</span>
              </div>
            </div>
          )}

          {error && <p className="profile-form-error" role="alert">{error}</p>}
          <div className="profile-setup-actions">
            {stepIndex > 0 && (
              <button
                type="button"
                className="profile-back-button"
                onClick={() => {
                  setError('');
                  setStep(setupSteps[stepIndex - 1].key);
                }}
              >
                <ArrowLeft size={15} /> BACK
              </button>
            )}
            <button className="profile-continue-button" type="submit" disabled={busy || (!client && !previewOnly)}>
              {busy
                ? 'SAVING…'
                : previewOnly && stepIndex === setupSteps.length - 1
                  ? 'EXIT PREVIEW'
                  : stepIndex === setupSteps.length - 1
                    ? 'SAVE & OPEN PROFILE'
                    : 'CONTINUE'}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>

      {step === 'goals' ? (
        <aside className="profile-setup-preview profile-setup-summary route-panel">
          <div className="profile-card-label">
            <span><UsersRound size={15} /> YOUR BOUGHT WILL FOCUS ON</span>
            <span className="profile-summary-count">{draft.goals.length} / {GOALS.length}</span>
          </div>
          <div className="profile-selection-list">
            {draft.goals.map((goal) => {
              const GoalIcon = GOALS.find((item) => item.label === goal)?.icon ?? Sparkles;
              return (
                <div key={goal}>
                  <span className="profile-selection-icon"><GoalIcon size={16} /></span>
                  <span>{goal}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${goal}`}
                    onClick={() => update('goals', draft.goals.filter((item) => item !== goal))}
                  >×</button>
                </div>
              );
            })}
            {!draft.goals.length && <p className="profile-summary-empty">Choose what you want to see first.</p>}
          </div>
          <div className="profile-summary-benefits">
            <div><Sparkles size={19} /><span><strong>More relevant broadcasts</strong><small>See content from people and topics you care about.</small></span></div>
            <div><Target size={19} /><span><strong>Smarter recommendations</strong><small>We’ll surface the most relevant people, ideas and opportunities.</small></span></div>
            <div><Lightbulb size={19} /><span><strong>You can change this later</strong><small>Your choices stay editable from your profile.</small></span></div>
          </div>
        </aside>
      ) : step === 'categories' ? (
        <aside className="profile-setup-preview profile-setup-summary route-panel">
          <div className="profile-card-label">
            <span><Compass size={15} /> YOUR SELECTION</span>
            <span className="profile-summary-count">{draft.categories.length} / {CATEGORIES.length}</span>
          </div>
          <div className="profile-selection-list">
            {draft.categories.map((category) => (
              <div key={category}>
                <span className="profile-selection-icon"><Compass size={16} /></span>
                <span>{category}</span>
                <button
                  type="button"
                  aria-label={`Remove ${category}`}
                  onClick={() => update('categories', draft.categories.filter((item) => item !== category))}
                >×</button>
              </div>
            ))}
            {!draft.categories.length && <p className="profile-summary-empty">Pick at least 3 categories for your feed.</p>}
          </div>
          <div className="profile-summary-benefits">
            <div><Sparkles size={19} /><span><strong>A more relevant feed</strong><small>See the people, categories and topics you care about.</small></span></div>
            <div><Target size={19} /><span><strong>Discover new opportunities</strong><small>Find broadcasts, people and ideas faster.</small></span></div>
            <div><Lightbulb size={19} /><span><strong>Fully customizable</strong><small>You can always edit your categories later.</small></span></div>
          </div>
        </aside>
      ) : (
        <aside className="profile-setup-preview route-panel">
          <div className="profile-card-label"><UserRound size={15} /> YOUR PUBLIC PREVIEW</div>
          <div className="profile-preview-identity">
            <ProfileAvatar
              initials={draft.fullName.slice(0, 2).toUpperCase() || 'BT'}
              imageSrc={draft.avatarUrl || undefined}
              imageMode="cover"
              className="profile-avatar-medium"
            />
            <div>
              <strong>{draft.fullName || 'Your name'}</strong>
              <span>@{draft.username || 'yourhandle'}</span>
            </div>
          </div>
          <p className="profile-preview-bio">{draft.bio || 'Your bio will sit beside every broadcast you publish.'}</p>
          <div className="profile-preview-includes">
            <span><Check size={14} /> {draft.categories.length || 'YOUR'} ROOMS</span>
            <span><Check size={14} /> NAME &amp; BIO</span>
            <span><Check size={14} /> AGE &amp; LOCATION</span>
            <span><Check size={14} /> SOCIAL LINKS</span>
            <span><Check size={14} /> BROADCASTS</span>
            <span className={draft.walletPublic ? '' : 'is-muted'}>{draft.walletPublic ? <Eye size={14} /> : <EyeOff size={14} />} WALLET SIGNAL</span>
          </div>
          <div className="profile-preview-footer">
            <span>PUBLIC PROFILE</span>
            <Globe2 size={14} />
          </div>
        </aside>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { client, session } = useBought();
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session?.user.email ?? '';
  const emailName = email.split('@')[0] || 'bought member';
  const memberProfile = profileDraft(metadata, email);
  const profileComplete = metadataBoolean(metadata, 'profile_completed');
  const setupRequired = Boolean(session && (!profileComplete || editing));
  const displayName = metadataValue(metadata, 'full_name', 'name') || emailName;
  const rawHandle = metadataValue(metadata, 'username', 'handle') || emailName;
  const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bio =
    metadataValue(metadata, 'bio', 'description') ||
    'Building in public. Backing ideas worth hearing.';
  const avatarUrl = memberProfile.avatarUrl;
  const age = memberProfile.age;
  const location = [memberProfile.city, memberProfile.country].filter(Boolean).join(', ') || memberProfile.location || 'Add your city';
  const preferredCategories = memberProfile.categories;
  const website = metadataValue(metadata, 'website', 'url');
  const xHandle = metadataValue(metadata, 'x', 'twitter', 'twitter_username');
  const linkedin = metadataValue(metadata, 'linkedin', 'linkedin_url');
  const walletAddress = metadataValue(metadata, 'wallet_address', 'wallet');
  const walletPublic = metadataBoolean(metadata, 'wallet_public');

  return (
    <MarketPageShell
      active="profile"
      eyebrow={
        !session
          ? previewing
            ? 'PROFILE SETUP / UI PREVIEW'
            : 'YOUR PROFILE / SIGN IN'
          : setupRequired
            ? 'PROFILE SETUP / YOUR DETAILS'
            : 'PUBLIC PROFILE / YOU'
      }
      title={
        !session
          ? previewing
            ? 'Preview your public profile.'
            : 'Find the winners. Tune your room.'
          : setupRequired
            ? 'Build your public profile.'
            : 'Your public signal.'
      }
      description={
        !session
          ? previewing
            ? 'This is a no-login preview. Try every step and nothing will be saved.'
            : 'Your profile keeps the rooms you care about close, helps you find today’s winners, and gives your own signal a home.'
          : setupRequired
            ? 'A few quick choices tune what rises into view and decide what the world sees when they find you on BOUGHT.'
            : 'One place for the identity, links, broadcasts, positions, and wallet signal you choose to put on the floor.'
      }
    >
      {previewing ? (
        <ProfileSetup
          initial={previewProfile}
          previewOnly
          onComplete={() => setPreviewing(false)}
        />
      ) : !session ? (
        <section className="profile-auth-layout">
          <article className="profile-auth-poster">
            <div className="profile-auth-header">
              <span className="profile-kicker">YOUR FIRST SIGNAL / LOCKED</span>
              <LockKeyhole size={19} />
            </div>
            <div className="profile-auth-identity">
              <ProfileAvatar initials="BT" className="profile-avatar-large" />
              <div>
                <span>YOUR FIRST VIEW</span>
                <strong>Ready to be tuned.</strong>
              </div>
            </div>
            <h2>FIND TODAY&apos;S WINNERS. FOLLOW THE SIGNAL.</h2>
            <p>
              Create a profile so BOUGHT can remember the rooms you care about,
              surface the people earning attention there, and keep your own
              signal attached to every broadcast. You can change your choices anytime.
            </p>
            <div className="profile-preview-grid">
              <span>
                <BadgeCheck size={16} /> FIND TODAY&apos;S WINNERS
              </span>
              <span>
                <Compass size={16} /> TUNE YOUR ROOMS
              </span>
              <span>
                <Radio size={16} /> SAVE YOUR SIGNAL
              </span>
              <span>
                <Pencil size={16} /> EDIT ANYTIME
              </span>
            </div>
          </article>
          <div className="profile-auth-entry">
            <DropSignIn
              title="TWO WAYS IN"
              description="Choose Google for one-tap access, or use your email for a password-free code. We’ll use your account to save preferences and build your public profile."
              showGoogle
            />
            <button
              type="button"
              className="profile-auth-preview-button"
              onClick={() => setPreviewing(true)}
            >
              <Eye size={16} />
              <span>
                <strong>CHECK ONBOARDING UI</strong>
                <small>Step through it with sample data. Nothing is saved.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      ) : setupRequired ? (
        <ProfileSetup
          initial={memberProfile}
          onComplete={() => setEditing(false)}
        />
      ) : (
        <>
          <section className="profile-hero-grid">
            <article className="profile-identity-card route-panel">
              <div className="profile-identity-header">
                <ProfileAvatar
                  initials={initials || 'BT'}
                  imageSrc={avatarUrl || undefined}
                  imageMode="cover"
                  className="profile-avatar-large"
                  alt={`${displayName} profile photo`}
                />
                <div className="profile-identity-name">
                  <span className="profile-kicker">
                    <i /> PUBLIC PROFILE
                  </span>
                  <h2>{displayName}</h2>
                  <p>{handle}</p>
                </div>
                <div className="profile-identity-actions">
                  <span className="profile-public-badge">
                    <Globe2 size={13} /> PUBLIC
                  </span>
                  <button
                    className="profile-icon-action"
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label="Edit your public profile"
                    title="Edit profile"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="profile-icon-action"
                    type="button"
                    onClick={() => void client?.auth.signOut()}
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
              <p className="profile-bio">{bio}</p>
              <div className="profile-meta-row">
                <span>
                  <MapPin size={14} /> {location}
                </span>
                <span>
                  <CalendarDays size={14} /> {age ? `${age} YEARS OLD` : 'ADD AGE'}
                </span>
              </div>
              <div className="profile-social-links" aria-label="Public social links">
                {website ? (
                  <a href={externalUrl(website)} target="_blank" rel="noreferrer">
                    <Globe2 size={14} /> {website.replace(/^https?:\/\//i, '')}
                    <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <span className="is-empty"><Globe2 size={14} /> ADD WEBSITE</span>
                )}
                {xHandle ? (
                  <a href={externalUrl(xHandle.startsWith('@') ? `x.com/${xHandle.slice(1)}` : xHandle)} target="_blank" rel="noreferrer">
                    <span className="profile-social-letter">X</span> {xHandle}
                    <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <span className="is-empty"><span className="profile-social-letter">X</span> ADD X</span>
                )}
                {linkedin ? (
                  <a href={externalUrl(linkedin)} target="_blank" rel="noreferrer">
                    <span className="profile-social-letter">in</span> LINKEDIN
                    <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <span className="is-empty"><span className="profile-social-letter">in</span> ADD LINKEDIN</span>
                )}
              </div>
              {preferredCategories.length > 0 && (
                <div className="profile-interest-list" aria-label="Preferred categories">
                  <span className="profile-interest-label">ROOMS I FOLLOW</span>
                  {preferredCategories.map((category) => (
                    <span className="profile-interest-chip" key={category}>{category}</span>
                  ))}
                </div>
              )}
            </article>

            <aside className="profile-wallet-card route-panel">
              <div className="profile-card-label">
                <WalletCards size={16} /> PUBLIC WALLET SIGNAL
              </div>
              <strong className="profile-wallet-balance">$18,600</strong>
              <span className="profile-wallet-caption">
                {walletPublic ? 'PUBLIC WALLET SIGNAL IS ON' : 'WALLET SIGNAL IS PRIVATE'}
              </span>
              <span className={`profile-wallet-address ${walletAddress ? '' : 'is-empty'}`}>
                <WalletCards size={13} /> {walletAddress || 'ADD A PUBLIC WALLET ADDRESS'}
              </span>
              <div className="profile-wallet-metrics">
                <span>
                  <small>ACTIVE BIDS</small>
                  <b>04</b>
                </span>
                <span>
                  <small>BEST POSITION</small>
                  <b>#01</b>
                </span>
              </div>
              <div className="profile-wallet-actions">
                <button className="profile-secondary-action" type="button" onClick={() => setEditing(true)}>
                  {walletAddress ? 'MANAGE WALLET' : 'ADD WALLET'} <WalletCards size={14} />
                </button>
                <Link className="profile-action" href="/broadcast">
                  MAKE A BROADCAST <ArrowUpRight size={15} />
                </Link>
              </div>
            </aside>
          </section>

          <section className="profile-stats-grid" aria-label="Profile performance">
            <div className="profile-stat-card">
              <span>BROADCASTS</span>
              <strong>12</strong>
              <em>PUBLIC</em>
            </div>
            <div className="profile-stat-card">
              <span>TOTAL VIEWS</span>
              <strong>38.4K</strong>
              <em>SINCE JOINING</em>
            </div>
            <div className="profile-stat-card">
              <span>GLOBAL REACH</span>
              <strong>184</strong>
              <em>COUNTRIES</em>
            </div>
            <div className="profile-stat-card profile-stat-hot">
              <span>BEST POSITION</span>
              <strong>#01</strong>
              <em>UNPOPULAR OPINION</em>
            </div>
          </section>

          <section className="profile-content-grid">
            <section className="profile-broadcasts route-panel">
              <div className="route-panel-head">
                <div>
                  <span className="eyebrow">PUBLIC BROADCASTS</span>
                  <h2>Your signal in the room.</h2>
                </div>
              </div>
              <div className="profile-broadcast-list">
                {featuredBroadcasts.map((broadcast, index) => (
                  <article className="profile-broadcast-row" key={broadcast.title}>
                    <span className="profile-broadcast-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="profile-broadcast-art"><Radio size={18} /></span>
                    <div className="profile-broadcast-copy">
                      <strong>{broadcast.title}</strong>
                      <span>{broadcast.category} · {broadcast.duration}</span>
                    </div>
                    <div className="profile-broadcast-value">
                      <strong>{broadcast.amount}</strong>
                      <span>{broadcast.views} VIEWS</span>
                    </div>
                    <ArrowUpRight className="profile-broadcast-arrow" size={15} />
                  </article>
                ))}
              </div>
            </section>

            <aside className="profile-activity-card route-panel">
              <div className="route-panel-head">
                <div>
                  <span className="eyebrow">RECENT ACTIVITY</span>
                  <h2>The tape remembers.</h2>
                </div>
                <span className="profile-live-mark"><i /> LIVE</span>
              </div>
              <div className="profile-activity-list">
                {publicActivity.map(([label, copy, time]) => (
                  <div className="profile-activity-row" key={label}>
                    <span className="profile-activity-dot"><ShieldCheck size={12} /></span>
                    <div>
                      <strong>{label}</strong>
                      <p>{copy}</p>
                    </div>
                    <time>{time}</time>
                  </div>
                ))}
              </div>
              <p className="profile-privacy-note">
                <Globe2 size={14} /> You control what the world sees on your public profile.
              </p>
            </aside>
          </section>
        </>
      )}
    </MarketPageShell>
  );
}
