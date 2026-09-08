'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Radio, Play, Video } from 'lucide-react';
import { useBought } from './bought-provider';
import { money } from '@/lib/drop-domain';
import { DropPlayer } from './drop-player';

export function PublishedLadder({
  category = 'ALL',
  compact = false,
}: {
  category?: string;
  compact?: boolean;
}) {
  const { entries, ladderConfigured } = useBought();
  const [playing, setPlaying] = useState<string | null>(null);
  const filtered = entries.filter(
    (entry) => category === 'ALL' || entry.category === category,
  );
  return (
    <section className="published-ladder dashboard-panel">
      <div className="dashboard-section-head">
        <span>
          <Radio size={15} /> GLOBAL LADDER
        </span>
        {compact && (
          <Link href="/ladder">
            VIEW ALL <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      {!filtered.length ? (
        <div className="ladder-empty">
          <Video size={32} strokeWidth={1.3} />
          <h2>THE FLOOR IS OPEN.</h2>
          <p>
            {ladderConfigured
              ? 'No approved broadcasts in this category yet. Your voice could be the first.'
              : 'The live ladder opens with the first verified, approved broadcasts.'}
          </p>
          <Link
            className="drop-button primary"
            href={`/drop${category !== 'ALL' ? `?category=${encodeURIComponent(category)}` : ''}`}
          >
            MAKE A BROADCAST
            <ArrowUpRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="published-ladder-list">
          {filtered.slice(0, compact ? 5 : 100).map((entry) => (
            <article className="published-drop" key={entry.drop_id}>
              <button
                onClick={() =>
                  setPlaying(playing === entry.drop_id ? null : entry.drop_id)
                }
                aria-expanded={playing === entry.drop_id}
              >
                <span className="published-rank">#{entry.position}</span>
                <span className="published-copy">
                  <small>{entry.category}</small>
                  <strong>{entry.title}</strong>
                </span>
                <span className="published-price">
                  {money(entry.amount_minor)}
                </span>
                <Play size={18} />
              </button>
              {playing === entry.drop_id && (
                <div className="published-player">
                  <DropPlayer dropId={entry.drop_id} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
