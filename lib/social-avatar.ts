export type SocialAvatarPlatform =
  | 'x'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';

export type SocialAvatarLookup = {
  platform: SocialAvatarPlatform;
  provider: string;
  identifier: string;
  normalizedUrl: string;
};

const RESERVED_X_PATHS = new Set([
  'compose',
  'explore',
  'home',
  'i',
  'intent',
  'messages',
  'notifications',
  'search',
  'settings',
]);

function cleanInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Paste a social profile link first.');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function publicHandle(value: string, platform: string) {
  const handle = decodeURIComponent(value).replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(handle)) {
    throw new Error(`Use a public ${platform} profile link.`);
  }
  return handle;
}

export function parseSocialAvatarUrl(input: string): SocialAvatarLookup {
  let url: URL;
  try {
    url = new URL(cleanInput(input));
  } catch {
    throw new Error('Enter a complete social profile link.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Enter a public social profile link.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.split('/').filter(Boolean);

  if (host === 'x.com' || host === 'twitter.com') {
    const handle = publicHandle(path[0] ?? '', 'X');
    if (RESERVED_X_PATHS.has(handle.toLowerCase())) {
      throw new Error('Use an X profile link, not an X page link.');
    }
    return {
      platform: 'x',
      provider: 'x',
      identifier: handle,
      normalizedUrl: `https://x.com/${handle}`,
    };
  }

  if (host === 'instagram.com') {
    const handle = publicHandle(path[0] ?? '', 'Instagram');
    if (
      ['explore', 'p', 'reel', 'reels', 'stories'].includes(
        handle.toLowerCase(),
      )
    ) {
      throw new Error(
        'Use an Instagram profile link, not a post or reel link.',
      );
    }
    return {
      platform: 'instagram',
      provider: 'instagram',
      identifier: handle,
      normalizedUrl: `https://instagram.com/${handle}`,
    };
  }

  if (host === 'linkedin.com') {
    const kind = path[0]?.toLowerCase();
    if (!['in', 'company'].includes(kind ?? '')) {
      throw new Error('Use a LinkedIn person or company profile link.');
    }
    const handle = publicHandle(path[1] ?? '', 'LinkedIn');
    return {
      platform: 'linkedin',
      provider: 'linkedin',
      identifier: `${kind === 'company' ? 'company' : 'user'}:${handle}`,
      normalizedUrl: `https://linkedin.com/${kind}/${handle}`,
    };
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const first = path[0] ?? '';
    const identifier = first.startsWith('@')
      ? publicHandle(first, 'YouTube')
      : publicHandle(path[1] ?? '', 'YouTube');
    if (
      !first.startsWith('@') &&
      !['c', 'channel', 'user'].includes(first.toLowerCase())
    ) {
      throw new Error('Use a YouTube channel profile link.');
    }
    return {
      platform: 'youtube',
      provider: 'youtube',
      identifier: first.startsWith('@') ? `@${identifier}` : identifier,
      normalizedUrl: first.startsWith('@')
        ? `https://youtube.com/@${identifier}`
        : `https://youtube.com/${first}/${identifier}`,
    };
  }

  if (host === 'tiktok.com') {
    const handle = publicHandle(path[0] ?? '', 'TikTok');
    return {
      platform: 'tiktok',
      provider: 'tiktok',
      identifier: handle,
      normalizedUrl: `https://tiktok.com/@${handle}`,
    };
  }

  throw new Error(
    'Use a public X, Instagram, LinkedIn, YouTube, or TikTok profile link.',
  );
}

export function socialAvatarImageUrl(lookup: SocialAvatarLookup) {
  return `https://unavatar.io/${lookup.provider}/${encodeURIComponent(lookup.identifier)}?fallback=false`;
}
