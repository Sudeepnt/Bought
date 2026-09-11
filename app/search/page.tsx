'use client';

import { Suspense } from 'react';
import {
  ArrowUpRight,
  Building2,
  Hash,
  PanelTop,
  Radio,
  SearchX,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { MarketPageShell } from '@/components/market-page-shell';
import { searchResults, type SearchResult } from '@/lib/search';

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  if (type === 'broadcast') return <Radio size={17} />;
  if (type === 'person') return <UserRound size={17} />;
  if (type === 'company') return <Building2 size={17} />;
  if (type === 'page') return <PanelTop size={17} />;
  return <Hash size={17} />;
}

function SearchResultsContent() {
  const params = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const results = searchResults(query);

  return (
    <MarketPageShell
      active="floor"
      eyebrow="GLOBAL SEARCH / MARKET INDEX"
      title={query ? `Results for “${query}”.` : 'Search the room.'}
      description="Search broadcasts, people, companies, and categories across the global floor."
    >
      <section className="search-results-panel route-panel">
        <div className="route-panel-head">
          <div>
            <span className="eyebrow">{query ? 'MATCHES FOUND' : 'START HERE'}</span>
            <h2>{query ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Find the signal you want.'}</h2>
          </div>
          <Link className="route-live" href="/categories">
            BROWSE CATEGORIES <ArrowUpRight size={14} />
          </Link>
        </div>

        {query && results.length ? (
          <div className="search-results-list">
            {results.map((result) => (
              <article className="search-result-card" key={result.id}>
                <span className={`search-result-card-icon is-${result.type}`}>
                  <ResultIcon type={result.type} />
                </span>
                <div className="search-result-card-copy">
                  <span>{result.subtitle}</span>
                  <h3>{result.title}</h3>
                  <p>{result.meta}</p>
                </div>
                <Link className="search-result-card-action" href={result.href}>
                  OPEN <ArrowUpRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="search-empty-state">
            <SearchX size={34} strokeWidth={1.2} />
            <h3>{query ? 'Nothing matched that search.' : 'Use the search bar above.'}</h3>
            <p>
              {query
                ? 'Try a person, company, category, or a few words from a broadcast title.'
                : 'Type a few words to scan the broadcasts and people moving through BOUGHT.'}
            </p>
            <Link className="drop-button primary" href="/categories">
              BROWSE CATEGORIES <ArrowUpRight size={17} />
            </Link>
          </div>
        )}
      </section>
    </MarketPageShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResultsContent />
    </Suspense>
  );
}
