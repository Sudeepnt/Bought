import { ArrowUpRight, Bookmark, Quote } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

const notes = [
  [
    '01',
    'FIELD NOTE',
    'The price of being seen.',
    'Visibility is no longer a vanity metric. It is a position you can take, hold, and defend.',
  ],
  [
    '02',
    'THE CLOSE',
    'Why the room changes after lock.',
    'Twelve hours of exposure turn a bid into proof that everyone can see.',
  ],
  [
    '03',
    'WORLD DESK',
    'Everyone arrives at a different hour.',
    'One shared market makes the overlap the product, not a limitation.',
  ],
];

export default function FieldNotesPage() {
  return (
    <MarketPageShell
      active="notes"
      eyebrow="FROM THE EDITORIAL DESK"
      title="What the market is saying."
      description="Short reads from inside the global attention exchange."
    >
      <section className="notes-grid">
        {notes.map(([number, label, title, copy], index) => (
          <article
            className={`note-card ${index === 0 ? 'is-featured' : ''}`}
            key={number}
          >
            <div>
              <span>
                {number} / {label}
              </span>
              <Bookmark size={16} />
            </div>
            <Quote size={20} />
            <h2>{title}</h2>
            <p>{copy}</p>
            <button type="button">
              READ NOTE <ArrowUpRight size={15} />
            </button>
          </article>
        ))}
      </section>
    </MarketPageShell>
  );
}
