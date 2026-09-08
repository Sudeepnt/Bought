'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '@/lib/drop-domain';
import { MarketTopbar } from '@/components/market-topbar';
import { PublishedLadder } from '@/components/published-ladder';

export default function LadderPage() {
  const [category, setCategory] = useState('ALL');
  return (
    <main className="market-shell dashboard-shell">
      <MarketTopbar active="ladder" />
      <div className="drop-page">
        <header className="drop-page-heading">
          <div>
            <span className="drop-eyebrow">THE GLOBAL FLOOR</span>
            <h1>
              PAID. CHECKED. SEEN<span>.</span>
            </h1>
            <p>
              Every position is backed by a verified payment and an approved
              broadcast.
            </p>
          </div>
          <Link href="/drop" className="drop-button primary">
            MAKE A BROADCAST
            <ArrowUpRight size={17} />
          </Link>
        </header>
        <fieldset className="ladder-filters" aria-label="Filter by category">
          {['ALL', ...CATEGORIES].map((item) => (
            <button
              key={item}
              aria-pressed={item === category}
              className={item === category ? 'selected' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </fieldset>
        <PublishedLadder category={category} />
        <p className="drop-fineprint">
          Bidding: 00:00–12:00 UTC. Final positions are held from 12:00–00:00
          UTC. Ranking and transitions are controlled by the server.
        </p>
      </div>
    </main>
  );
}
