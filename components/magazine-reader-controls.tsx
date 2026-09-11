'use client';

import { ArrowDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useState } from 'react';
import { latestIssue, magazinePdfHref } from '@/lib/magazine';

const pages = [
  'daily-review-title',
  'latest-issue',
  'broadcast-dossier',
  'exposure-package',
  'recent-editions-title',
  'history-title',
];

export function MagazineReaderControls() {
  const [page, setPage] = useState(0);

  function turnTo(nextPage: number) {
    const target = pages[nextPage];
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPage(nextPage);
  }

  return (
    <nav className="magazine-reader-controls" aria-label="Issue 05 reader controls">
      <div className="magazine-reader-turns">
        <button
          type="button"
          onClick={() => turnTo(page - 1)}
          disabled={page === 0}
          aria-label="Previous magazine page"
        >
          <ChevronLeft size={17} />
        </button>
        <span>ISSUE 05 / PAGE {String(page + 1).padStart(2, '0')} OF {String(pages.length).padStart(2, '0')}</span>
        <button
          type="button"
          onClick={() => turnTo(page + 1)}
          disabled={page === pages.length - 1}
          aria-label="Next magazine page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="magazine-reader-actions">
        <button type="button" onClick={() => turnTo(Math.min(page + 1, pages.length - 1))}>
          CONTINUE READING <ArrowDown size={14} />
        </button>
        <a
          href={magazinePdfHref(latestIssue)}
          download={`bought-review-${latestIssue.slug}.pdf`}
        >
          DOWNLOAD ISSUE <Download size={14} />
        </a>
      </div>
    </nav>
  );
}
