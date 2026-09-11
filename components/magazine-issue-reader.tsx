'use client';

import Image from 'next/image';
import Link from '@/components/site-link';
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { useState } from 'react';

import { MarketFooter } from '@/components/market-chrome';
import { MarketTopbar } from '@/components/market-topbar';
import {
  magazineIssueHref,
  magazinePdfHref,
  type MagazineIssue,
} from '@/lib/magazine';

const readerPages = ['COVER', 'THE POSITION', 'THE RECEIPT'];

export function MagazineIssueReader({ issue }: { issue: MagazineIssue }) {
  const [page, setPage] = useState(0);
  const isFirstPage = page === 0;
  const isLastPage = page === readerPages.length - 1;

  return (
    <main className="market-shell dashboard-shell magazine-library-shell magazine-issue-shell">
      <MarketTopbar active="magazine" />
      <div className="magazine-issue-page">
        <header className="magazine-issue-bar">
          <Link href="/magazine">← ISSUE ARCHIVE</Link>
          <span>BOUGHT / THE REVIEW / ISSUE {issue.number}</span>
          <a
            href={magazinePdfHref(issue)}
            download={`bought-review-${issue.slug}.pdf`}
          >
            DOWNLOAD PDF <Download size={14} />
          </a>
        </header>

        <section className="magazine-reader-stage" aria-label={`Issue ${issue.number} reader`}>
          <article
            className={`magazine-reader-sheet is-${issue.tone} is-page-${page}`}
            aria-live="polite"
          >
            {page === 0 && (
              <>
                <Image
                  src={issue.image}
                  alt={`BOUGHT Review Issue ${issue.number} cover featuring ${issue.person}`}
                  fill
                  priority
                  sizes="(max-width: 760px) 100vw, 680px"
                />
                <span className="magazine-reader-cover-wash" aria-hidden="true" />
                <div className="magazine-reader-cover-top">
                  <span>THE DAILY RECORD OF THE MARKET</span>
                  <span>{issue.date}</span>
                </div>
                <div className="magazine-reader-cover-mark">
                  <strong>BOUGHT</strong>
                  <span>THE REVIEW</span>
                </div>
                <div className="magazine-reader-cover-copy">
                  <span>{issue.category}</span>
                  <h1>{issue.title}</h1>
                  <p>{issue.person} / ISSUE {issue.number}</p>
                </div>
              </>
            )}

            {page === 1 && (
              <div className="magazine-reader-editorial">
                <span className="magazine-reader-folio">01 / THE POSITION</span>
                <h1>{issue.title}</h1>
                <p className="magazine-reader-deck">
                  This issue preserves the public position exactly as it was
                  published. It is a record of the result, not an editorial
                  profile written on behalf of the winner.
                </p>
                <div className="magazine-reader-facts">
                  <div>
                    <span>POSITION</span>
                    <strong>{issue.category}</strong>
                  </div>
                  <div>
                    <span>ON THE COVER</span>
                    <strong>{issue.person}</strong>
                  </div>
                  <div>
                    <span>PUBLISHED</span>
                    <strong>{issue.date}</strong>
                  </div>
                </div>
                <blockquote>
                  “The title, rank, and approved public media are enough to
                  make a durable issue. Extra bidder information is optional.”
                </blockquote>
              </div>
            )}

            {page === 2 && (
              <div className="magazine-reader-receipt">
                <span className="magazine-reader-folio">02 / THE RECEIPT</span>
                <h1>A record readers can return to.</h1>
                <div className="magazine-reader-metrics">
                  <div>
                    <strong>{issue.views}</strong>
                    <span>ISSUE VIEWS</span>
                  </div>
                  <div>
                    <strong>{issue.opens}</strong>
                    <span>COVER OPENS</span>
                  </div>
                  <div>
                    <strong>{issue.category.replace(' / #1', '')}</strong>
                    <span>ROOM</span>
                  </div>
                </div>
                <div className="magazine-reader-rule" />
                <div className="magazine-reader-record-note">
                  <FileText size={22} />
                  <p>
                    BOUGHT only prints information already approved for public
                    publication: the title, category, final placement,
                    timestamp, thumbnail or broadcast, and optional profile
                    links. No questionnaire is needed to publish the issue.
                  </p>
                </div>
                <Link href={magazineIssueHref(issue)} className="magazine-reader-share-link">
                  ISSUE LINK READY TO SHARE ↗
                </Link>
              </div>
            )}
            <footer>
              <span>BOUGHT / THE REVIEW</span>
              <span>ISSUE {issue.number} / PAGE {String(page + 1).padStart(2, '0')}</span>
            </footer>
          </article>
        </section>

        <nav className="magazine-issue-controls" aria-label="Magazine pages">
          <button
            type="button"
            disabled={isFirstPage}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft size={17} /> PREVIOUS
          </button>
          <span>
            ISSUE {issue.number} / PAGE {String(page + 1).padStart(2, '0')} OF {String(readerPages.length).padStart(2, '0')} / {readerPages[page]}
          </span>
          <button
            type="button"
            disabled={isLastPage}
            onClick={() => setPage((current) => current + 1)}
          >
            NEXT <ChevronRight size={17} />
          </button>
        </nav>

        <section className="magazine-issue-provenance">
          <span>AUTOMATIC ISSUE FORMAT</span>
          <p>
            A Review can be generated from verified, public market data. The
            winner can add a public profile or links later, but the record does
            not wait for a biography, an interview, or extra form fields.
          </p>
        </section>

        <MarketFooter />
      </div>
    </main>
  );
}
