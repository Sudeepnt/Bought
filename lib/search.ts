import { CATEGORIES } from '@/lib/drop-domain';

export type SearchResultType =
  | 'broadcast'
  | 'person'
  | 'company'
  | 'category'
  | 'page';

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  meta: string;
  keywords: string;
  href: string;
};

const featuredBroadcasts: SearchResult[] = [
  {
    id: 'notion-anytype',
    type: 'broadcast',
    title: 'I switched from Notion to Anytype. Here’s why.',
    subtitle: 'WHY I SWITCHED',
    meta: '$9,200 broadcast',
    keywords: 'notion anytype switched why broadcast',
    href: '/search/broadcast/notion-anytype',
  },
  {
    id: 'linkedin-ads',
    type: 'broadcast',
    title: 'We spent $50,000 on LinkedIn ads. Here are the results.',
    subtitle: 'SHOW THE RECEIPTS',
    meta: '$7,800 broadcast',
    keywords: 'linkedin ads receipts results broadcast',
    href: '/search/broadcast/linkedin-ads',
  },
  {
    id: 'landing-page-teardown',
    type: 'broadcast',
    title: 'Roast my landing page. Be brutal.',
    subtitle: 'TEARDOWN',
    meta: '$5,900 broadcast',
    keywords: 'landing page roast teardown broadcast',
    href: '/search/broadcast/landing-page-teardown',
  },
  {
    id: 'yc-ai-fund',
    type: 'broadcast',
    title: "Reacting to Y Combinator's new AI fund.",
    subtitle: 'REACT',
    meta: '$4,600 broadcast',
    keywords: 'y combinator ai fund react broadcast',
    href: '/search/broadcast/yc-ai-fund',
  },
  {
    id: 'claude-kimi',
    type: 'broadcast',
    title: 'Is Claude still worth $30 when Kimi K3 does it for $3?',
    subtitle: 'WORTH IT?',
    meta: '$6,400 broadcast',
    keywords: 'claude kimi k3 ai price worth broadcast',
    href: '/search/broadcast/claude-kimi',
  },
  {
    id: 'ai-sdrs',
    type: 'broadcast',
    title: 'You said AI can replace SDRs. Prove it.',
    subtitle: 'PROVE IT?',
    meta: '$5,900 broadcast',
    keywords: 'ai sdr sales prove broadcast',
    href: '/search/broadcast/ai-sdrs',
  },
];

const people: SearchResult[] = [
  ['Ananya Rao', '@ananyabuilds', 'Founder'],
  ['Arjun S.', '@arjunsays', 'Builder'],
  ['Priya M.', '@priyamakes', 'Operator'],
  ['Rahul K.', '@rahulbuilds', 'Creator'],
  ['Karan V.', '@karanv', 'Founder'],
  ['Maya K.', '@mayaknowsthis', 'Creator'],
  ['Dev P.', '@devpicks', 'Investor'],
  ['Simran N.', '@simrannotes', 'Creator'],
  ['Kabir J.', '@kabirj', 'Builder'],
  ['Aisha T.', '@aishatellsit', 'Creator'],
].map(([title, subtitle, meta]) => ({
  id: title
    .toLocaleLowerCase()
    .replaceAll('.', '')
    .replaceAll(' ', '-'),
  type: 'person' as const,
  title,
  subtitle,
  meta,
  keywords: `${title} ${subtitle} ${meta}`,
  href: `/search/person/${title
    .toLocaleLowerCase()
    .replaceAll('.', '')
    .replaceAll(' ', '-')}`,
}));

const companies: SearchResult[] = [
  ['Notion', 'PRODUCT', 'Workspace'],
  ['Anytype', 'PRODUCT', 'Workspace'],
  ['LinkedIn', 'COMPANY', 'Professional network'],
  ['Y Combinator', 'COMPANY', 'Startup accelerator'],
  ['Claude', 'PRODUCT', 'AI assistant'],
  ['Kimi K3', 'PRODUCT', 'AI model'],
].map(([title, subtitle, meta]) => ({
  id: title.toLocaleLowerCase().replaceAll(' ', '-'),
  type: 'company' as const,
  title,
  subtitle,
  meta,
  keywords: `${title} ${subtitle} ${meta}`,
  href: `/search/company/${title
    .toLocaleLowerCase()
    .replaceAll(' ', '-')}`,
}));

const categories: SearchResult[] = CATEGORIES.map((category) => ({
  id: `category-${category}`,
  type: 'category',
  title: category,
  subtitle: 'CATEGORY',
  meta: 'Global market room',
  keywords: `${category} category market room`,
  href: `/categories?category=${encodeURIComponent(category)}`,
}));

const sitePages: SearchResult[] = [
  ['today', 'TODAY', 'MARKET PAGE', 'Live global market', '/'],
  ['categories', 'CATEGORIES', 'MARKET PAGE', 'Browse market rooms', '/categories'],
  ['chat', 'MESSAGES', 'ACCOUNT', 'Your direct messages', '/chat'],
  ['watchlist', 'WATCHLIST', 'MARKET PAGE', 'Tracked positions', '/watchlist'],
  ['magazine', 'MAGAZINE', 'MARKET PAGE', 'BOUGHT Review', '/magazine'],
  ['how-it-works', 'HOW IT WORKS', 'MARKET PAGE', 'Auction rules', '/how-it-works'],
  ['broadcast', 'MAKE A BROADCAST', 'ACTION', 'Start a paid broadcast', '/broadcast'],
  ['profile', 'PROFILE', 'ACCOUNT', 'Your BOUGHT profile', '/profile'],
  ['review', 'REVIEW', 'MARKET PAGE', 'Moderator queue', '/review'],
  ['terms', 'TERMS', 'MARKET PAGE', 'Terms and conditions', '/terms'],
].map(([id, title, subtitle, meta, href]) => ({
  id,
  type: 'page' as const,
  title,
  subtitle,
  meta,
  keywords: `${title} ${subtitle} ${meta}`,
  href,
}));

function scoreResult(result: SearchResult, query: string) {
  const title = result.title.toLocaleLowerCase();
  const keywords = result.keywords.toLocaleLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (keywords.includes(query)) return 3;
  return 4;
}

export function searchResults(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];

  const allResults = [
    ...featuredBroadcasts,
    ...people,
    ...companies,
    ...categories,
    ...sitePages,
  ];
  const seen = new Set<string>();

  return allResults
    .filter((result) => {
      const searchable = `${result.title} ${result.subtitle} ${result.meta} ${result.keywords}`.toLocaleLowerCase();
      if (!searchable.includes(normalized) || seen.has(result.title)) return false;
      seen.add(result.title);
      return true;
    })
    .sort((left, right) => scoreResult(left, normalized) - scoreResult(right, normalized));
}

export function findSearchResult(type: string, id: string) {
  if (type === 'broadcast')
    return featuredBroadcasts.find((result) => result.id === id) ?? null;
  if (type === 'person')
    return people.find((result) => result.id === id) ?? null;
  if (type === 'company')
    return companies.find((result) => result.id === id) ?? null;
  return null;
}
