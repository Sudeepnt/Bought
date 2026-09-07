'use client';

import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';

const categories = [
  ['ALL', '1,155'],
  ['BEEF', '184'],
  ['CHAOS', '28'],
  ['UNPOPULAR OPINION', '162'],
  ['I WAS WRONG', '141'],
  ['THE RANT', '118'],
  ['CONFESSIONS', '96'],
  ['MONEY I SET ON FIRE', '88'],
  ['THE PITCH THAT GOT REJECTED', '74'],
  ['BUILDING', '69'],
  ['THE ASK', '61'],
  ['HIRING', '54'],
  ['AGENCY ROW', '43'],
  ['INDIAN D2C', '37'],
] as const;

const players = [
  ['Ananya Rao', 'AN', 'BEEF', '₹18,200', 'SG'],
  ['Rahul K.', 'RK', 'BEEF', '₹18,047', 'US'],
  ['Karan V.', 'KV', 'CHAOS', '₹17,832', 'US'],
  ['Maya Chen', 'MC', 'THE RANT', '₹17,741', 'IN'],
  ['Ananya Rao', 'AN', 'CHAOS', '₹17,679', 'IN'],
  ['Jon Bell', 'JB', 'UNPOPULAR OPINION', '₹17,588', 'US'],
  ['Rahul K.', 'RK', 'CHAOS', '₹17,526', 'BR'],
  ['Nia Patel', 'NP', 'UNPOPULAR OPINION', '₹17,351', 'IN'],
  ['Arjun S.', 'AS', 'BUILDING', '₹16,920', 'IN'],
  ['Priya M.', 'PM', 'THE ASK', '₹16,610', 'US'],
];

export default function CategoriesPage() {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const filteredPlayers = useMemo(() => {
    if (activeCategory === 'ALL') return players;
    const matching = players.filter((player) => player[2] === activeCategory);
    return matching.length > 0
      ? matching
      : players.map((player, index) => [
          `${player[0].split(' ')[0]} ${index + 1}`,
          player[1],
          activeCategory,
          `₹${(18200 - index * 377).toLocaleString('en-IN')}`,
          player[4],
        ]);
  }, [activeCategory]);

  return (
    <MarketPageShell
      active="categories"
      eyebrow="GLOBAL CATEGORIES / ONE LADDER"
      title="Choose a room to own."
      description="One category at a time. Every board ranks its top ten by total spend."
    >
      <section className="category-page-picker" aria-label="Choose a category">
        {categories.map(([category, bids]) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? 'is-active' : ''}
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
          >
            <strong>{category}</strong>
            <span>{bids} bids</span>
          </button>
        ))}
      </section>

      <section className="category-page-layout">
        <div className="route-panel category-ladder-panel">
          <div className="route-panel-head">
            <div>
              <span className="eyebrow">{activeCategory} / TOP 10</span>
              <h2>
                {activeCategory === 'ALL'
                  ? 'Highest bid across every category.'
                  : `The top spend in ${activeCategory}.`}
              </h2>
            </div>
            <span className="route-live">
              <i /> LIVE
            </span>
          </div>
          <div className="category-page-rows">
            {filteredPlayers
              .slice(0, 10)
              .map(([name, initials, category, bid, country], index) => (
                <button
                  type="button"
                  className="category-page-row"
                  key={`${name}-${index}`}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <ProfileAvatar
                    initials={initials}
                    className="category-row-avatar"
                  />
                  <strong>
                    {name}
                    <em>
                      {category} / {country}
                    </em>
                  </strong>
                  <span>{bid}</span>
                </button>
              ))}
          </div>
        </div>

        <aside className="category-video-card">
          <div className="category-video-preview">
            <span>00:30</span>
            <button aria-label="Play the current leader's video" type="button">
              <Play size={17} />
            </button>
          </div>
          <span className="eyebrow">CURRENT LEADER / VIDEO TAKE</span>
          <h2>
            {activeCategory === 'ALL' ? 'Ananya Rao' : filteredPlayers[0][0]}
          </h2>
          <p>
            “The position is moving. Watch before you decide to challenge it.”
          </p>
          <strong>
            ₹18,200 <em>TOP POSITION</em>
          </strong>
        </aside>
      </section>
    </MarketPageShell>
  );
}
