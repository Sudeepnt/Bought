const IMAGES = [
  'swipe-rocket.jpg',
  'swipe-data-center.jpg',
  'swipe-robotics.jpg',
  'swipe-battery.jpg',
  'swipe-founders.jpg',
  'swipe-rocket.jpg',
  'swipe-data-center.jpg',
];

export type NewspaperEdition = {
  date: string;
  title: string;
  longDate: string;
  image: string;
};

const DAY = 86_400_000;

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Editions follow the market's UTC day: today first, then each earlier day. */
export function newspaperEditions(count = 7, now = new Date()): NewspaperEdition[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getTime() - index * DAY);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(date);
    return {
      date: isoDate(date),
      title:
        index === 0
          ? 'Today'
          : index === 1
            ? 'Yesterday'
            : index === 2
              ? 'The day before'
              : weekday,
      longDate: longDate(date),
      image: `/newspaper/assets/${IMAGES[index % IMAGES.length]}`,
    };
  });
}
