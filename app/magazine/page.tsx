import { ArrowUpRight, BookOpen, FileText } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

export default function MagazinePage() {
  return (
    <MarketPageShell
      active="magazine"
      eyebrow="THE BOUGHT MAGAZINE / ISSUE 01"
      title="The cost of being seen."
      description="A virtual edition for the people who take a position before the room catches up."
    >
      <section className="magazine-route-layout">
        <div
          className="magazine-cover route-magazine-cover"
          aria-label="BOUGHT Issue 01 cover"
        >
          <div className="cover-top">
            <span>BOUGHT</span>
            <span>ISSUE 01</span>
          </div>
          <div className="cover-stamp">
            THE
            <br />
            COST
            <br />
            OF
            <br />
            BEING
            <br />
            <em>SEEN</em>
          </div>
          <div className="cover-bottom">
            <span>GLOBAL ATTENTION EXCHANGE</span>
            <span>2026</span>
          </div>
        </div>
        <div className="route-panel magazine-route-copy">
          <span className="eyebrow">
            <BookOpen size={14} /> THE VIRTUAL MAGAZINE
          </span>
          <h2>Read the room between broadcasts.</h2>
          <p>
            Issue 01 follows the people who spend to be seen, the signals that
            move a category, and the consequences of holding the top spot.
          </p>
          <div className="issue-details">
            <span>
              <b>42</b> PAGES
            </span>
            <span>
              <b>06</b> DISPATCHES
            </span>
            <span>
              <b>01</b> GLOBAL EDITION
            </span>
          </div>
          <button type="button" className="route-primary-button">
            <FileText size={15} /> READ ISSUE 01 <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="issue-contents">
          <span className="eyebrow">IN THIS ISSUE</span>
          <div>
            <b>01</b>
            <span>The price of being seen.</span>
          </div>
          <div>
            <b>02</b>
            <span>Why the room changes after lock.</span>
          </div>
          <div>
            <b>03</b>
            <span>Everyone arrives at a different hour.</span>
          </div>
        </div>
      </section>
    </MarketPageShell>
  );
}
