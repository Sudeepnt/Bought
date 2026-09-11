'use client';

import { Suspense } from 'react';
import { ArrowLeft, ArrowUpRight, Building2, Radio, UserRound } from 'lucide-react';
import Link from '@/components/site-link';
import { useParams } from 'next/navigation';

import { MarketPageShell } from '@/components/market-page-shell';
import { findSearchResult, type SearchResult } from '@/lib/search';

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  if (type === 'person') return <UserRound size={22} />;
  if (type === 'company') return <Building2 size={22} />;
  return <Radio size={22} />;
}

function resultDescription(result: SearchResult) {
  if (result.type === 'person')
    return 'Public player record. Explore the market context and broadcasts connected to this voice.';
  if (result.type === 'company')
    return 'Company and product signal collected from broadcasts moving through the global floor.';
  return 'Featured broadcast from the approved broadcasts currently on the floor.';
}

function resultAction(result: SearchResult) {
  if (result.type === 'person')
    return { href: '/categories', label: 'BROWSE CATEGORIES' };
  if (result.type === 'company')
    return { href: '/broadcast', label: 'MAKE A BROADCAST' };
  return { href: '/broadcast', label: 'MAKE A BROADCAST' };
}

function SearchDetailContent() {
  const params = useParams<{ type: string; id: string }>();
  const result = findSearchResult(params.type, params.id);

  if (!result) {
    return (
      <MarketPageShell
        active="floor"
        eyebrow="SEARCH / NOT FOUND"
        title="That result is no longer on the board."
        description="Try another search or explore today’s active categories."
      >
        <section className="search-empty-state route-panel">
          <Link className="drop-button primary" href="/search">
            <ArrowLeft size={17} /> BACK TO SEARCH
          </Link>
        </section>
      </MarketPageShell>
    );
  }

  const action = resultAction(result);
  return (
    <MarketPageShell
      active="floor"
      eyebrow={`SEARCH / ${result.type.toUpperCase()}`}
      title={result.title}
      description={resultDescription(result)}
    >
      <section className="search-detail-panel route-panel">
        <Link className="search-detail-back" href={`/search?q=${encodeURIComponent(result.title)}`}>
          <ArrowLeft size={14} /> BACK TO RESULTS
        </Link>
        <div className="search-detail-card">
          <span className={`search-result-card-icon is-${result.type}`}>
            <ResultIcon type={result.type} />
          </span>
          <div>
            <span className="eyebrow">{result.subtitle}</span>
            <h2>{result.title}</h2>
            <p>{result.meta}</p>
          </div>
        </div>
        <p className="search-detail-description">{resultDescription(result)}</p>
        <Link className="drop-button primary" href={action.href}>
          {action.label} <ArrowUpRight size={17} />
        </Link>
      </section>
    </MarketPageShell>
  );
}

export default function SearchDetailPage() {
  return (
    <Suspense fallback={null}>
      <SearchDetailContent />
    </Suspense>
  );
}
