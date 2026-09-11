'use client';

import Link from '@/components/site-link';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CalendarDays,
  Eye,
  EyeOff,
  Globe2,
  Link2,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  Radio,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { DropSignIn } from '@/components/drop-sign-in';
import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useBought } from '@/components/bought-provider';

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

function metadataBoolean(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return value === true || value === 'true' || value === 1;
}

type ProfileDraft = {
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
  return {
    fullName: metadataValue(metadata, 'full_name', 'name'),
    username: rawHandle.replace(/^@/, ''),
    bio: metadataValue(metadata, 'bio', 'description'),
    location: metadataValue(metadata, 'location', 'city'),
    website: metadataValue(metadata, 'website', 'url'),
    x: metadataValue(metadata, 'x', 'twitter', 'twitter_username'),
    linkedin: metadataValue(metadata, 'linkedin', 'linkedin_url'),
    walletAddress: metadataValue(metadata, 'wallet_address', 'wallet'),
    walletPublic: metadataBoolean(metadata, 'wallet_public'),
  };
}

const setupSteps = [
  {
    key: 'identity',
    label: 'IDENTITY',
    title: 'Tell the room who you are.',
    description: 'This is the name and context people see beside your signal.',
  },
  {
    key: 'reach',
    label: 'DISCOVERY',
    title: 'Make it easy to find you.',
    description: 'Add the places where your ideas already have a pulse.',
  },
  {
    key: 'wallet',
    label: 'WALLET SIGNAL',
    title: 'Choose what your wallet says.',
    description: 'Your balance stays in BOUGHT. You decide whether the public signal is visible.',
  },
] as const;

type SetupStep = (typeof setupSteps)[number]['key'];

function ProfileSetup({
  initial,
  onComplete,
}: {
  initial: ProfileDraft;
  onComplete: () => void;
}) {
  const { client } = useBought();
  const [step, setStep] = useState<SetupStep>('identity');
  const [draft, setDraft] = useState<ProfileDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stepIndex = setupSteps.findIndex((item) => item.key === step);
  const current = setupSteps[stepIndex];

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((valueBefore) => ({ ...valueBefore, [key]: value }));
  }

  function continueSetup(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 'identity') {
      if (draft.fullName.trim().length < 2)
        return setError('Add the name you want the world to see.');
      if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(draft.username.trim()))
        return setError('Use a handle with 2–32 letters, numbers, dots, dashes, or underscores.');
    }
    if (stepIndex < setupSteps.length - 1) {
      setStep(setupSteps[stepIndex + 1].key);
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
          full_name: draft.fullName.trim(),
          username: draft.username.trim(),
          bio: draft.bio.trim(),
          location: draft.location.trim(),
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
          <span>STEP {stepIndex + 1} / {setupSteps.length}</span>
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
          {step === 'identity' && (
            <div className="profile-form-fields">
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
              <label className="profile-field">
                LOCATION <span className="profile-field-optional">OPTIONAL</span>
                <input
                  autoComplete="address-level2"
                  value={draft.location}
                  onChange={(event) => update('location', event.target.value)}
                  placeholder="City, country"
                  maxLength={60}
                />
              </label>
            </div>
          )}

          {step === 'reach' && (
            <div className="profile-form-fields">
              <label className="profile-field">
                WEBSITE <span className="profile-field-optional">OPTIONAL</span>
                <input
                  type="url"
                  value={draft.website}
                  onChange={(event) => update('website', event.target.value)}
                  placeholder="https://your-site.com"
                />
              </label>
              <label className="profile-field">
                X PROFILE <span className="profile-field-optional">OPTIONAL</span>
                <input
                  value={draft.x}
                  onChange={(event) => update('x', event.target.value)}
                  placeholder="@yourhandle or x.com/yourhandle"
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
              <div className="profile-setup-note">
                <Globe2 size={16} />
                <span>These links appear beside your broadcasts so interested people can follow the signal.</span>
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
            <button className="profile-continue-button" type="submit" disabled={busy || !client}>
              {busy ? 'SAVING…' : stepIndex === setupSteps.length - 1 ? 'SAVE & OPEN PROFILE' : 'CONTINUE'}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </section>

      <aside className="profile-setup-preview route-panel">
        <div className="profile-card-label"><UserRound size={15} /> YOUR PUBLIC PREVIEW</div>
        <div className="profile-preview-identity">
          <ProfileAvatar initials={draft.fullName.slice(0, 2).toUpperCase() || 'BT'} className="profile-avatar-medium" />
          <div>
            <strong>{draft.fullName || 'Your name'}</strong>
            <span>@{draft.username || 'yourhandle'}</span>
          </div>
        </div>
        <p className="profile-preview-bio">{draft.bio || 'Your bio will sit beside every broadcast you publish.'}</p>
        <div className="profile-preview-includes">
          <span><Check size={14} /> NAME &amp; BIO</span>
          <span><Check size={14} /> SOCIAL LINKS</span>
          <span><Check size={14} /> BROADCASTS</span>
          <span className={draft.walletPublic ? '' : 'is-muted'}>{draft.walletPublic ? <Eye size={14} /> : <EyeOff size={14} />} WALLET SIGNAL</span>
        </div>
        <div className="profile-preview-footer">
          <span>PUBLIC PROFILE</span>
          <Globe2 size={14} />
        </div>
      </aside>
    </div>
  );
}

export default function ProfilePage() {
  const { client, session } = useBought();
  const [editing, setEditing] = useState(false);
  const metadata = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = session?.user.email ?? '';
  const emailName = email.split('@')[0] || 'bought member';
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
  const location = metadataValue(metadata, 'location', 'city') || 'Add your city';
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
          ? 'YOUR PROFILE / SIGN IN'
          : setupRequired
            ? 'PROFILE SETUP / YOUR DETAILS'
            : 'PUBLIC PROFILE / YOU'
      }
      title={
        !session
          ? 'Make your signal public.'
          : setupRequired
            ? 'Build your public profile.'
            : 'Your public signal.'
      }
      description={
        !session
          ? 'Sign in first. Then add your details, links, and wallet signal before your profile goes public.'
          : setupRequired
            ? 'Three quick choices decide what the world sees when they find you on BOUGHT.'
            : 'One place for the identity, links, broadcasts, positions, and wallet signal you choose to put on the floor.'
      }
    >
      {!session ? (
        <section className="profile-auth-layout">
          <article className="profile-auth-poster">
            <div className="profile-auth-header">
              <span className="profile-kicker">PUBLIC PROFILE / LOCKED</span>
              <LockKeyhole size={19} />
            </div>
            <div className="profile-auth-identity">
              <ProfileAvatar initials="BT" className="profile-avatar-large" />
              <div>
                <span>YOUR IDENTITY</span>
                <strong>Ready to be seen.</strong>
              </div>
            </div>
            <h2>PUT YOUR NAME ON THE BOARD.</h2>
            <p>
              Sign in once to keep your bids, broadcasts, social links, and
              public wallet signal together across every device.
            </p>
            <div className="profile-preview-grid">
              <span>
                <BadgeCheck size={16} /> YOUR NAME &amp; BIO
              </span>
              <span>
                <Link2 size={16} /> SOCIAL LINKS
              </span>
              <span>
                <Radio size={16} /> BROADCASTS &amp; POSITIONS
              </span>
              <span>
                <WalletCards size={16} /> PUBLIC WALLET SIGNAL
              </span>
            </div>
          </article>
          <DropSignIn
            title="SIGN IN OR LOG IN"
            description="Use your email to sign in or create your BOUGHT account. We’ll send a one-time code—no password to remember."
          />
        </section>
      ) : setupRequired ? (
        <ProfileSetup
          initial={profileDraft(metadata, email)}
          onComplete={() => setEditing(false)}
        />
      ) : (
        <>
          <section className="profile-hero-grid">
            <article className="profile-identity-card route-panel">
              <div className="profile-identity-header">
                <ProfileAvatar initials={initials || 'BT'} className="profile-avatar-large" />
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
                  <CalendarDays size={14} /> MEMBER SINCE 2026
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
