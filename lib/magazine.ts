export type MagazineTone = 'blue' | 'red' | 'orange' | 'green' | 'charcoal';

export type MagazineIssue = {
  slug: string;
  number: string;
  date: string;
  tableDate: string;
  person: string;
  category: string;
  title: string;
  image: string;
  tone: MagazineTone;
  views: string;
  opens: string;
};

export const latestIssue: MagazineIssue = {
  slug: 'all-2026-09-09',
  number: '05',
  date: '09 SEPTEMBER 2026',
  tableDate: '09 SEP 2026',
  person: 'ANANYA RAO',
  category: 'ALL / #1 OVERALL',
  title: 'THE COST OF BEING SEEN',
  image: '/ananya-rao-hero.webp',
  tone: 'charcoal',
  views: '84,600',
  opens: '18,200',
};

export const categoryIssues: MagazineIssue[] = [
  {
    slug: 'building-2026-09-09',
    number: '04',
    date: '09 SEPTEMBER 2026',
    tableDate: '09 SEP 2026',
    person: 'ARJUN SEN',
    category: 'BUILDING / #1',
    title: 'BUILD BEFORE THEY BELIEVE',
    image: '/magazine/issue-01-blue.png',
    tone: 'blue',
    views: '26,400',
    opens: '6,100',
  },
  {
    slug: 'the-rant-2026-09-09',
    number: '03',
    date: '09 SEPTEMBER 2026',
    tableDate: '09 SEP 2026',
    person: 'MAYA KHAN',
    category: 'THE RANT / #1',
    title: 'SAY THE QUIET PART OUT LOUD',
    image: '/magazine/issue-02-red.png',
    tone: 'red',
    views: '19,800',
    opens: '4,800',
  },
  {
    slug: 'money-2026-09-09',
    number: '02',
    date: '09 SEPTEMBER 2026',
    tableDate: '09 SEP 2026',
    person: 'PRIYA MEHTA',
    category: 'MONEY I SET ON FIRE / #1',
    title: 'WHAT THE ROOM WILL PAY FOR',
    image: '/magazine/issue-03-orange.png',
    tone: 'orange',
    views: '17,100',
    opens: '4,100',
  },
  {
    slug: 'unpopular-opinion-2026-09-09',
    number: '01',
    date: '09 SEPTEMBER 2026',
    tableDate: '09 SEP 2026',
    person: 'MARCUS REED',
    category: 'UNPOPULAR OPINION / #1',
    title: 'EVERY POINT HAS A PRICE',
    image: '/magazine/issue-04-green.png',
    tone: 'green',
    views: '15,300',
    opens: '3,600',
  },
];

export const roomIssues: MagazineIssue[] = [
  ['beef-2026-09-09', 'BEEF', 'DEV ARORA', 'THE BEEF LEDGER', '14,800', '3,400', 'red'],
  ['chaos-2026-09-09', 'CHAOS', 'LINA THOMAS', 'THE CHAOS INDEX', '12,900', '3,000', 'orange'],
  ['wrong-2026-09-09', 'I WAS WRONG', 'ROHAN SHAH', 'THE REVISION NOTE', '11,700', '2,700', 'blue'],
  ['confessions-2026-09-09', 'CONFESSIONS', 'ADA KIM', 'THE PUBLIC ADMISSION', '10,800', '2,500', 'green'],
  ['pitch-2026-09-09', 'THE PITCH THAT GOT REJECTED', 'SANJAY BOSE', 'THE REJECTION FILE', '10,200', '2,400', 'charcoal'],
  ['ask-2026-09-09', 'THE ASK', 'CHLOE WU', 'THE OPEN QUESTION', '9,600', '2,200', 'blue'],
  ['hiring-2026-09-09', 'HIRING', 'NEEL GUPTA', 'THE HIRING NOTE', '9,100', '2,100', 'orange'],
  ['agency-row-2026-09-09', 'AGENCY ROW', 'LEILA HADDAD', 'THE AGENCY RECORD', '8,900', '2,000', 'red'],
  ['indian-d2c-2026-09-09', 'INDIAN D2C', 'RITESH JAIN', 'THE D2C RECEIPT', '8,400', '1,900', 'green'],
].map(([slug, category, person, title, views, opens, tone], index) => ({
  slug,
  number: String(index + 5).padStart(2, '0'),
  date: '09 SEPTEMBER 2026',
  tableDate: '09 SEP 2026',
  person,
  category: `${category} / #1`,
  title,
  image: `/magazine/issue-0${(index % 4) + 1}-${['blue', 'red', 'orange', 'green'][index % 4]}.png`,
  tone: tone as MagazineTone,
  views,
  opens,
}));

export const dailyEditions: MagazineIssue[] = [
  {
    slug: 'all-2026-09-08',
    number: '04',
    date: '08 SEPTEMBER 2026',
    tableDate: '08 SEP 2026',
    person: 'KABIR MALIK',
    category: 'ALL / #1 OVERALL',
    title: 'THE PATIENCE TO HOLD',
    image: '/magazine/archive-2026-09-08.png',
    tone: 'blue',
    views: '126,000',
    opens: '21,400',
  },
  {
    slug: 'all-2026-09-07',
    number: '03',
    date: '07 SEPTEMBER 2026',
    tableDate: '07 SEP 2026',
    person: 'NIA KAPOOR',
    category: 'ALL / #1 OVERALL',
    title: 'THE ROOM CHANGED ITS MIND',
    image: '/magazine/archive-2026-09-07.png',
    tone: 'red',
    views: '109,000',
    opens: '18,700',
  },
  {
    slug: 'all-2026-09-06',
    number: '02',
    date: '06 SEPTEMBER 2026',
    tableDate: '06 SEP 2026',
    person: 'JULES REED',
    category: 'ALL / #1 OVERALL',
    title: 'DON’T ASK FOR THE ROOM',
    image: '/magazine/archive-2026-09-06.png',
    tone: 'green',
    views: '91,000',
    opens: '15,800',
  },
];

const firstIssue: MagazineIssue = {
  slug: 'all-2026-09-05',
  number: '01',
  date: '05 SEPTEMBER 2026',
  tableDate: '05 SEP 2026',
  person: 'SOFIA DESAI',
  category: 'ALL / #1 OVERALL',
  title: 'THE FIRST RECORD',
  image: '/magazine/archive-2026-09-06.png',
  tone: 'charcoal',
  views: '76,000',
  opens: '13,400',
};

export const historyIssues = [latestIssue, ...dailyEditions, firstIssue];
export const magazineIssues = [
  latestIssue,
  ...categoryIssues,
  ...roomIssues,
  ...dailyEditions,
  firstIssue,
];

export function magazineIssueHref(issue: Pick<MagazineIssue, 'slug'>) {
  return `/magazine/${issue.slug}`;
}

export function magazinePdfHref(issue: Pick<MagazineIssue, 'slug'>) {
  return `/magazine/${issue.slug}.pdf`;
}

export function getMagazineIssue(slug: string) {
  return magazineIssues.find((issue) => issue.slug === slug) ?? null;
}
