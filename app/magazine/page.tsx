/* oxlint-disable jsx-a11y/prefer-tag-over-role -- CSS grid preserves the editorial table layout. */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Eye, LockKeyhole } from 'lucide-react';

import { MarketFooter } from '@/components/market-chrome';
import { MagazineReaderControls } from '@/components/magazine-reader-controls';
import { MarketTopbar } from '@/components/market-topbar';
import {
  categoryIssues,
  dailyEditions,
  historyIssues,
  latestIssue,
  magazineIssueHref,
  roomIssues,
  type MagazineIssue,
} from '@/lib/magazine';

export const metadata: Metadata = {
  title: 'The BOUGHT Review — Daily Issue Archive',
  description:
    'Every BOUGHT drop becomes a daily record: one overall #1 cover, category leaders, and a permanent public archive.',
};

const publicationSteps = [
  ['01', 'THE DROP LOCKS', 'Final order is set at 12:00 UTC.'],
  ['02', 'LEADERS ARE VERIFIED', 'Published broadcasts and winning positions are cleared.'],
  ['03', 'THE REVIEW OPENS', 'The next day, ALL #1 and room leaders become the daily issue.'],
] as const;

const placementValue = [
  ['THE ALL COVER', 'The daily overall #1 gets the cover that every reader sees first.'],
  ['THE ROOM COVER', 'Every category #1 receives a named edition in the same daily Review.'],
  ['THE RECEIPT', 'Your title, broadcast, rank, and issue reach live together in the archive.'],
] as const;

const dailyLeaderLabels = [
  ['BEEF / #1', 'CHAOS / #1', 'CONFESSIONS / #1', 'THE ASK / #1'],
  ['BUILDING / #1', 'THE RANT / #1', 'HIRING / #1', 'INDIAN D2C / #1'],
  ['AGENCY ROW / #1', 'I WAS WRONG / #1', 'MONEY / #1', 'THE PITCH / #1'],
] as const;

const editionDays = ['YESTERDAY', 'THE DAY BEFORE', 'THREE DAYS AGO'] as const;

function MagazineCover({
  issue,
  featured = false,
}: {
  issue: MagazineIssue;
  featured?: boolean;
}) {
  return (
    <Link
      className={`magazine-cover-card ${featured ? 'magazine-all-cover' : ''} is-${issue.tone}`}
      href={magazineIssueHref(issue)}
      aria-label={`Open BOUGHT Review Issue ${issue.number}: ${issue.title}`}
    >
      <Image
        src={issue.image}
        alt={`BOUGHT Review Issue ${issue.number} cover featuring ${issue.person}`}
        fill
        priority={featured}
        sizes={featured ? '(max-width: 760px) 100vw, 54vw' : '(max-width: 760px) 48vw, 25vw'}
      />
      <span className="magazine-cover-wash" aria-hidden="true" />
      <span className="magazine-cover-masthead">BOUGHT</span>
      <span className="magazine-cover-review">THE REVIEW / {featured ? 'ALL' : 'ROOM'}</span>
      <span className="magazine-cover-number">NO. {issue.number}</span>
      <span className="magazine-cover-meta"><b>{issue.category}</b></span>
      <strong>{issue.title}</strong>
      <span className="magazine-cover-person">{issue.person}</span>
    </Link>
  );
}

export default function MagazinePage() {
  return (
    <main className="market-shell dashboard-shell magazine-library-shell">
      <MarketTopbar active="magazine" />

      <div className="magazine-library-page magazine-daily-page">
        <header className="magazine-library-masthead">
          <div className="magazine-library-topline">
            <span>EST. 2026 / GLOBAL EDITION</span>
            <span>THE DAILY RECORD OF THE MARKET</span>
            <span>ISSUE ARCHIVE</span>
          </div>
          <div className="magazine-library-title-row">
            <Link href="/" aria-label="BOUGHT home">BOUGHT</Link>
            <div><span>THE</span><strong>REVIEW</strong></div>
          </div>
        </header>

        <MagazineReaderControls />

        <section className="magazine-publish-brief" aria-labelledby="daily-review-title">
          <div>
            <span className="magazine-library-kicker">THE DAILY REVIEW</span>
            <h1 id="daily-review-title">Drop today. Own tomorrow&apos;s page.</h1>
          </div>
          <div>
            <p>Each BOUGHT drop becomes a public issue the next day: one cover for the overall #1, then one named cover for every category leader.</p>
            <Link href="/broadcast">TAKE A POSITION IN THE NEXT DROP <ArrowUpRight size={15} /></Link>
          </div>
        </section>

        <section className="magazine-publication-flow" aria-label="How the daily Review is published">
          {publicationSteps.map(([number, title, copy]) => (
            <article key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></article>
          ))}
          <aside><span>THE POINT</span><p>A paid position is temporary. A daily issue is the receipt that stays.</p></aside>
        </section>

        <section className="magazine-all-section" aria-labelledby="all-issue-title">
          <header>
            <span>LATEST EDITION / PUBLISHED AFTER THE 08 SEP DROP</span>
            <h2 id="all-issue-title">The cover that owns the whole market.</h2>
            <p>One overall #1 gets the biggest page in the daily Review.</p>
          </header>
          <div className="magazine-all-grid">
            <MagazineCover issue={latestIssue} featured />
            <article className="magazine-all-copy">
              <span className="magazine-library-kicker">ALL #1 / ISSUE 05</span>
              <h2>One point of view rose above every category.</h2>
              <p>This cover belongs to the single position that held the most weight when the drop locked. It is where the day&apos;s entire room begins.</p>
              <dl>
                <div><dt>ISSUE REACH</dt><dd>84.6K VIEWS</dd></div>
                <div><dt>COVER OPENS</dt><dd>18.2K</dd></div>
                <div><dt>ROOMS DOCUMENTED</dt><dd>13</dd></div>
              </dl>
              <Link href={magazineIssueHref(latestIssue)}>READ THE ALL ISSUE <ArrowUpRight size={15} /></Link>
            </article>
          </div>
        </section>

        <section className="magazine-room-section" aria-labelledby="room-issues-title">
          <header>
            <span>THE REST OF TODAY&apos;S ISSUE</span>
            <h2 id="room-issues-title">A #1 cover for each room.</h2>
            <p>Four featured covers from today&apos;s 13 category-leader editions.</p>
          </header>
          <div className="magazine-room-grid">
            {categoryIssues.map((issue) => (
              <div className="magazine-room-edition" key={issue.number}>
                <MagazineCover issue={issue} />
                <span><Eye size={13} /> {issue.views} ISSUE VIEWS</span>
              </div>
            ))}
          </div>
        </section>

        <section className="magazine-full-room-index" aria-labelledby="full-room-index-title">
          <header>
            <span className="magazine-library-kicker">THE FULL ISSUE / 13 ROOM EDITIONS</span>
            <h2 id="full-room-index-title">Every room has a leader worth opening.</h2>
            <p>The remaining #1 editions from today&apos;s drop, each carrying its own rank and reach.</p>
          </header>
          <div className="magazine-full-room-grid">
            {roomIssues.map((issue, index) => (
              <Link href={magazineIssueHref(issue)} key={issue.slug}>
                <span>{String(index + 5).padStart(2, '0')}</span>
                <strong>{issue.category.replace(' / #1', '')}</strong>
                <em>{issue.person}</em>
                <b><Eye size={12} /> {issue.views}</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="magazine-edition-reach" aria-label="Latest issue reach">
          <div><strong>163.2K</strong><span>ISSUE VIEWS</span></div>
          <div><strong>42.7K</strong><span>UNIQUE READERS</span></div>
          <div><strong>13</strong><span>ROOM LEADERS</span></div>
          <div><strong>1</strong><span>ALL #1 COVER</span></div>
        </section>

        <section className="magazine-latest-issue" id="latest-issue">
          <div className="magazine-latest-folio"><span>THE ALL ISSUE</span><strong>05</strong><span>09 / 09 / 2026</span></div>
          <article>
            <span className="magazine-library-kicker">THE COST OF BEING SEEN</span>
            <h2>Being first matters. Being recorded as first matters longer.</h2>
            <p>The Review is where a winning BOUGHT position stops being a moment in the market and becomes a page readers can return to. Your broadcast, claim, rank, and the attention it earned stay together.</p>
            <p>The next drop is your chance to put a point of view in the running. The next day is when the winning work becomes part of BOUGHT history.</p>
          </article>
          <aside>
            <span className="magazine-library-kicker">ON THIS PAGE</span>
            <ol>
              <li><span>01</span> The overall position readers see first.</li>
              <li><span>02</span> The category leaders that shaped the drop.</li>
              <li><span>03</span> The reach that remains attached to the issue.</li>
            </ol>
            <Link href="/">SEE TODAY&apos;S BOARD <ArrowUpRight size={14} /></Link>
          </aside>
        </section>

        <section className="magazine-broadcast-dossier" id="broadcast-dossier" aria-labelledby="broadcast-dossier-title">
          <header>
            <span className="magazine-library-kicker">PAGE 03 / THE BROADCAST</span>
            <h2 id="broadcast-dossier-title">What earns a place in the daily issue.</h2>
            <p>A good broadcast gives readers a position they can understand, remember, and respond to.</p>
          </header>
          <article className="magazine-dossier-feature">
            <div>
              <span>THE POSITION</span>
              <blockquote>“If you want attention, make a claim strong enough to be wrong about.”</blockquote>
              <p>That is the kind of clear, defensible point a BOUGHT broadcast puts into the room.</p>
            </div>
            <dl>
              <div><dt>BROADCAST</dt><dd>01:42 MINUTES</dd></div>
              <div><dt>FORMAT</dt><dd>DIRECT TAKE + PROOF</dd></div>
              <div><dt>DISCOVERABILITY</dt><dd>ALL + CATEGORY ISSUE</dd></div>
              <div><dt>PROFILE LINE</dt><dd>HANDLE, SITE, X, LINKEDIN</dd></div>
            </dl>
          </article>
          <div className="magazine-broadcast-checklist">
            <article><span>01</span><h3>STATE THE CLAIM</h3><p>Give the room one specific point of view, not a generic pitch.</p></article>
            <article><span>02</span><h3>SHOW THE RECEIPT</h3><p>Bring the data, the work, the failure, or the reason you believe it.</p></article>
            <article><span>03</span><h3>MAKE IT SHAREABLE</h3><p>Keep the take focused enough that a reader can repeat it in one sentence.</p></article>
          </div>
        </section>

        <section className="magazine-placement-story magazine-why-placement" aria-labelledby="placement-title">
          <header>
            <span className="magazine-library-kicker">WHY GET ON THE REVIEW</span>
            <h2 id="placement-title">Your position deserves more than a countdown.</h2>
          </header>
          <div className="magazine-placement-copy">
            <p>A bid gets you into the drop. A #1 result earns a page that gives your point of view a title, a face, a category, a broadcast, and a public history of the attention it received.</p>
            <p>You are not buying editorial approval. You are choosing to compete for a position worth documenting.</p>
          </div>
        </section>

        <section className="magazine-placement-flow magazine-placement-value" aria-label="What a winning position receives">
          {placementValue.map(([title, copy], index) => (
            <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
          <article className="magazine-placement-action">
            <Link href="/broadcast">PUT YOURSELF IN THE NEXT ISSUE <ArrowUpRight size={16} /></Link>
            <small><LockKeyhole size={13} /> Page placement follows reviewed #1 results; payment alone never guarantees editorial placement.</small>
          </article>
        </section>

        <section className="magazine-exposure-package" id="exposure-package" aria-labelledby="exposure-package-title">
          <header>
            <span className="magazine-library-kicker">PAGE 04 / THE EXPOSURE PACKAGE</span>
            <h2 id="exposure-package-title">Your issue should point back to you.</h2>
            <p>When your public profile is complete, BOUGHT gives readers a clean path from your position to the places you already publish.</p>
          </header>
          <div className="magazine-exposure-grid">
            <article>
              <span>01 / ATTRIBUTION</span>
              <h3>Your name travels with the claim.</h3>
              <p>Your public handle, website, X profile, and LinkedIn can sit with a published broadcast so readers can find your work after the issue.</p>
              <Link href="/profile">ADD YOUR PUBLIC LINKS <ArrowUpRight size={14} /></Link>
            </article>
            <article>
              <span>02 / SHARE KIT</span>
              <h3>Give the winner something worth posting.</h3>
              <p>The issue gives you a cover, your broadcast link, and a compact performance line to share back to your own channels.</p>
              <div className="magazine-share-caption"><b>READY TO POST</b><p>“My BOUGHT position made today&apos;s Review. Read the claim, watch the broadcast, challenge the room.”</p></div>
            </article>
            <article>
              <span>03 / REACH LEDGER</span>
              <h3>See what the issue actually did.</h3>
              <p>Issue views, cover opens, and broadcast visits remain attached to the entry, so attention is visible instead of promised.</p>
              <div className="magazine-reach-ledger"><span><strong>84.6K</strong> ISSUE VIEWS</span><span><strong>18.2K</strong> COVER OPENS</span><span><strong>6.4K</strong> BROADCAST VISITS</span></div>
            </article>
          </div>
          <p className="magazine-exposure-note"><LockKeyhole size={13} /> BOUGHT can attribute and link to the public accounts you provide, and gives you share-ready issue assets. External-platform distribution and follower growth are never guaranteed.</p>
        </section>

        <section className="magazine-recent-editions" aria-labelledby="recent-editions-title">
          <header>
            <span>THE LAST 48 HOURS</span>
            <h2 id="recent-editions-title">Yesterday&apos;s leaders. The day before&apos;s proof.</h2>
            <p>Every day gets its own issue. The archive gets more valuable as the record grows.</p>
          </header>
          <div className="magazine-recent-grid">
            {dailyEditions.slice(0, 2).map((edition, index) => (
              <article className="magazine-history-edition" key={edition.number}>
                <MagazineCover issue={edition} />
                <div className="magazine-history-copy">
                  <span>{editionDays[index]} / {edition.date}</span>
                  <h3>{edition.title}</h3>
                  <p><b>{edition.person}</b> held the ALL #1 cover after the drop locked.</p>
                  <div className="magazine-history-stats"><span><strong>{edition.views}</strong> ISSUE VIEWS</span><span><strong>{edition.opens}</strong> COVER OPENS</span></div>
                  <ul aria-label={`Category leaders in Issue ${edition.number}`}>
                    {dailyLeaderLabels[index].map((leader) => <li key={leader}>{leader}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="magazine-history" aria-labelledby="history-title">
          <header>
            <span className="magazine-library-kicker">THE HISTORY / ALL ISSUES</span>
            <h2 id="history-title">The record only gets harder to enter.</h2>
            <p>Every daily ALL cover remains in the BOUGHT archive with its final reach.</p>
          </header>
          <div className="magazine-history-table" role="table" aria-label="BOUGHT Review daily issue history">
            <div className="magazine-history-row magazine-history-head" role="row">
              <span role="columnheader">PUBLISHED</span><span role="columnheader">ISSUE</span><span role="columnheader">ALL COVER</span><span role="columnheader">POSITION</span><span role="columnheader">REACH</span>
            </div>
            {historyIssues.map((issue) => (
              <Link href={magazineIssueHref(issue)} className="magazine-history-row" key={issue.slug}>
                <span>{issue.tableDate}</span><span>NO. {issue.number}</span><strong>{issue.person}</strong><span>{issue.category.replace(' OVERALL', '')}</span><b>{issue.views} <Eye size={12} /></b>
              </Link>
            ))}
          </div>
        </section>

        <section className="magazine-library-cta" aria-labelledby="claim-title">
          <div>
            <span className="magazine-library-kicker">THE NEXT DROP IS YOUR OPENING</span>
            <h2 id="claim-title">Make the next issue impossible to ignore.</h2>
          </div>
          <div>
            <p>Choose the room. Make the broadcast. Put your money behind the point. Take the position that earns a page tomorrow.</p>
            <Link href="/broadcast">CLAIM A POSITION <ArrowUpRight size={17} /></Link>
            <small><LockKeyhole size={13} /> The Review records reviewed #1 positions after each drop; it is not a paid editorial endorsement.</small>
          </div>
        </section>

        <MarketFooter />
      </div>
    </main>
  );
}
