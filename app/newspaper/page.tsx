import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

import { MarketFooter } from '@/components/market-chrome';
import Link from '@/components/site-link';
import { newspaperEditions, type NewspaperEdition } from '@/lib/newspaper';

import './newspaper.css';

export const metadata: Metadata = { title: 'Newspaper | BOUGHT' };
export const dynamic = 'force-dynamic';

function Cover({ edition }: { edition: NewspaperEdition }) {
  return (
    <Link
      className="newspaper-cover"
      href={`/newspaper/issue.html?date=${edition.date}`}
      aria-label={`Open the ${edition.title} edition, ${edition.longDate}`}
    >
      <Image
        src={edition.image}
        alt=""
        fill
        sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 360px"
      />
      <span className="newspaper-cover-top">
        <span>BOUGHT</span>
        <span>{edition.date}</span>
      </span>
      <span className="newspaper-cover-bottom">
        <strong>{edition.title}</strong>
        <small>{edition.longDate}</small>
      </span>
    </Link>
  );
}

export default function NewspaperPage() {
  const [today, ...earlier] = newspaperEditions();

  return (
    <main className="market-shell dashboard-shell paper-page newspaper-library-shell">

      <div className="newspaper-library-page">
        <header className="newspaper-masthead">
          <div className="newspaper-topline">
            <span>EST. 2026 / GLOBAL EDITION</span>
            <span>THE DAILY NEWSPAPER</span>
            <span>EDITION ARCHIVE</span>
          </div>
          <div className="newspaper-title-row">
            <h1>NEWSPAPER</h1>
            <p>Today&apos;s edition first, then every earlier day.</p>
          </div>
        </header>

        <section className="newspaper-today" aria-label="Today's edition">
          <Cover edition={today} />
          <article className="newspaper-today-copy">
            <span className="newspaper-topline">TODAY&apos;S EDITION</span>
            <h2>{today.longDate}</h2>
            <p>
              The full daily issue: top stories, quick glances and the
              broadcast spotlight, with a podcast edition of the same issue.
            </p>
            <Link href={`/newspaper/issue.html?date=${today.date}`}>
              READ TODAY&apos;S NEWSPAPER <ArrowUpRight size={15} />
            </Link>
          </article>
        </section>

        <div className="newspaper-section-label">EARLIER EDITIONS</div>
        <section className="newspaper-room-grid" aria-label="Earlier editions">
          {earlier.map((edition) => (
            <Cover edition={edition} key={edition.date} />
          ))}
        </section>

        <MarketFooter />
      </div>
    </main>
  );
}
