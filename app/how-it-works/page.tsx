import {
  ArrowRight,
  CircleDollarSign,
  Eye,
  Globe2,
  LockKeyhole,
  Radio,
  Timer,
  Trophy,
} from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

const rules = [
  {
    number: '01',
    time: '00:00—12:00 UTC',
    phase: 'BIDDING WINDOW',
    title: 'ENTER THE AUCTION',
    copy: 'Choose one category and place your bid. Your paid bid sets your position; the highest total spend leads the daily market.',
    Icon: Trophy,
  },
  {
    number: '02',
    time: 'WHILE BIDDING IS OPEN',
    phase: 'LIVE POSITIONING',
    title: 'THE ORDER MOVES',
    copy: 'Anyone can outbid you during the twelve-hour auction. Every move is public, and position #1 gets the most visibility.',
    Icon: Eye,
  },
  {
    number: '03',
    time: '12:00—00:00 UTC',
    phase: 'EXPOSURE WINDOW',
    title: 'EXPOSURE LOCKS',
    copy: 'The final order is held for twelve hours in public view. Your position is fixed for the window and becomes the proof.',
    Icon: LockKeyhole,
  },
];

export default function HowItWorksPage() {
  return (
    <MarketPageShell
      active="rules"
      eyebrow="THE BOUGHT MODEL"
      title="One auction. One market."
      description="The same global market resolves in UTC, regardless of where someone joins the room."
    >
      <div className="how-it-works-grid">
        <section className="how-it-works-section" aria-labelledby="what-you-do">
          <header className="how-it-works-section-head">
            <div>
              <span className="eyebrow">01 / YOUR SIDE</span>
              <h2 id="what-you-do">WHAT YOU DO</h2>
            </div>
            <span>MAKE YOUR MOVE</span>
          </header>
          <ol className="rules-timeline" aria-label="What you do on BOUGHT">
            {rules.map(({ number, time, phase, title, copy, Icon }) => (
              <li className="rule-card" key={number}>
                <span className="rule-timeline-dot" aria-hidden="true" />
                <article className="rule-card-content">
                  <div className="rule-card-meta">
                    <span>{number}</span>
                    <span>{time}</span>
                    <span>{phase}</span>
                  </div>
                  <div className="rule-card-heading">
                    <Icon size={22} aria-hidden="true" />
                    <h3>{title}</h3>
                  </div>
                  <p>{copy}</p>
                </article>
              </li>
            ))}
            <li className="rules-timeline-end">
              <span aria-hidden="true" />
              <p>
                <b>00:00 UTC</b> The next auction opens and the cycle starts
                again.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="how-it-works-section bought-cycle-section"
          aria-labelledby="what-bought-does"
        >
          <header className="how-it-works-section-head">
            <div>
              <span className="eyebrow">02 / THE SYSTEM</span>
              <h2 id="what-bought-does">WHAT BOUGHT DOES</h2>
            </div>
            <span className="how-it-works-global-label">
              <Globe2 size={13} /> ONE GLOBAL CLOCK
            </span>
          </header>
          <div
            className="bought-cycle-visual"
            aria-label="The BOUGHT 24-hour auction and exposure cycle"
          >
            <div className="bought-cycle-summary">
              <span>THE BOUGHT LOOP</span>
              <strong>
                12H AUCTION <i>→</i> DROP <i>→</i> 12H EXPOSURE
              </strong>
              <p>Bid for rank. The broadcast drops. Your position stays visible.</p>
            </div>

            <div className="bought-cycle-diagram">
              <div className="bought-cycle-dial" aria-hidden="true">
                <span className="bought-cycle-dial-time is-start">
                  00:00 <small>AUCTION OPENS</small>
                </span>
                <div className="bought-cycle-dial-ring">
                  <span className="bought-cycle-dial-phase is-auction">
                    <Timer size={15} />
                    <b>AUCTION</b>
                    <small>12 HOURS</small>
                  </span>
                  <span className="bought-cycle-dial-phase is-exposure">
                    <LockKeyhole size={15} />
                    <b>EXPOSURE</b>
                    <small>12 HOURS</small>
                  </span>
                  <i className="bought-cycle-dial-runner" />
                  <i className="bought-cycle-dial-drop" />
                </div>
                <div className="bought-cycle-dial-center">
                  <small>ONE GLOBAL</small>
                  <strong>24H</strong>
                  <span>UTC CYCLE</span>
                </div>
                <span className="bought-cycle-dial-time is-drop">
                  12:00 <small>THE DROP</small>
                </span>
              </div>

              <ol className="bought-cycle-steps-compact">
                <li className="is-auction">
                  <span className="bought-cycle-step-number">01</span>
                  <div>
                    <small>00:00—12:00 UTC</small>
                    <strong>AUCTION</strong>
                    <p>Bids move broadcasts up and down the live order.</p>
                  </div>
                </li>
                <li className="is-drop">
                  <span className="bought-cycle-step-number"><Radio size={14} /></span>
                  <div>
                    <small>12:00 UTC</small>
                    <strong>DROP</strong>
                    <p>Bidding stops. The final broadcast order goes live.</p>
                  </div>
                </li>
                <li className="is-exposure">
                  <span className="bought-cycle-step-number">02</span>
                  <div>
                    <small>12:00—00:00 UTC</small>
                    <strong>EXPOSURE</strong>
                    <p>The final order locks and every position stays fixed for 12 hours.</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bought-cycle-result">
              <div>
                <CircleDollarSign size={17} aria-hidden="true" />
                <span><small>YOU DO</small><strong>BID FOR POSITION</strong></span>
              </div>
              <ArrowRight size={15} aria-hidden="true" />
              <div>
                <Radio size={17} aria-hidden="true" />
                <span><small>BOUGHT DOES</small><strong>RESOLVES THE ORDER</strong></span>
              </div>
              <ArrowRight size={15} aria-hidden="true" />
              <div>
                <Eye size={17} aria-hidden="true" />
                <span><small>THE WORLD SEES</small><strong>12H FIXED ORDER</strong></span>
              </div>
            </div>

            <div className="bought-cycle-footer">
              <span className="bought-cycle-pulse" aria-hidden="true" />
              <span>AT 00:00 UTC, THE NEXT AUCTION STARTS</span>
              <span>ONE MARKET · ONE GLOBAL CLOCK</span>
            </div>
          </div>
        </section>
      </div>

    </MarketPageShell>
  );
}
