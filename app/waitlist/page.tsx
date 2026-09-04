'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useState } from 'react';
import { ArrowRight, Check, Clock3, Globe2, Mail, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const steps = [
  {
    number: '01',
    label: 'CHOOSE',
    title: 'Choose what you want seen.',
    copy: 'Bring a product, project, opinion, profile, or idea to one of BOUGHT’s global markets.',
  },
  {
    number: '02',
    label: 'BID',
    title: 'Spend to move up.',
    copy: 'During the live auction, your spend determines your position on the public ladder.',
  },
  {
    number: '03',
    label: 'HOLD',
    title: 'Keep the room for 12 hours.',
    copy: 'When the auction locks, the ladder stops moving. Your position stays visible while the world catches up.',
  },
  {
    number: '04',
    label: 'DROP',
    title: 'Return for the next opening.',
    copy: 'At the next UTC drop, the board opens again. One market. One ladder. A new chance to rise.',
  },
];

const faq = [
  {
    question: 'What am I joining?',
    answer:
      'The early-access list for BOUGHT, a global attention exchange where positions are earned through a shared auction.',
  },
  {
    question: 'Do I pay anything now?',
    answer:
      'No. Joining the waitlist only reserves your place for launch updates and the first market invitation.',
  },
  {
    question: 'When does the market open?',
    answer:
      'The live schedule runs in UTC: 12 hours of auction, followed by 12 hours of locked exposure. The first drop time will be sent by email.',
  },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const joinWaitlist = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const value = email.trim();
    if (!value || !value.includes('@')) {
      setError('Enter a valid email to join.');
      return;
    }
    setError('');
    setJoined(true);
  };

  return (
    <main className="waitlist-shell">
      <header className="waitlist-topbar">
        <a
          className="brand-mark"
          href="/waitlist"
          aria-label="BOUGHT waitlist home"
        >
          <span className="brand-dot" />
          <span>BOUGHT</span>
        </a>
        <div className="waitlist-topbar-meta">
          <span className="status-dot is-live" />
          <span>EARLY ACCESS OPEN</span>
          <span className="status-separator">/</span>
          <a href="/#top">
            VIEW MARKET <ArrowRight size={13} />
          </a>
        </div>
      </header>

      <div className="waitlist-ticker" aria-label="BOUGHT product description">
        <span>ONE GLOBAL AUCTION</span>
        <span>ONE PUBLIC LADDER</span>
        <span>12H LIVE / 12H LOCKED</span>
        <span>UTC-NATIVE</span>
        <span>EARLY ACCESS NOW OPEN</span>
      </div>

      <section className="waitlist-hero">
        <div className="waitlist-hero-copy">
          <p className="kicker">
            <Globe2 size={13} /> GLOBAL ATTENTION EXCHANGE
          </p>
          <h1>
            Get your name
            <br />
            <em>on the ladder.</em>
          </h1>
          <p className="waitlist-lede">
            BOUGHT is one shared market for being seen. People, products, and
            ideas compete for a visible position on the same global ladder.
          </p>
          <div className="waitlist-proof-row">
            <div>
              <strong>01</strong>
              <span>MARKET</span>
            </div>
            <div>
              <strong>184</strong>
              <span>COUNTRIES</span>
            </div>
            <div>
              <strong>24H</strong>
              <span>FULL CYCLE</span>
            </div>
          </div>
        </div>

        <section
          className="waitlist-form-panel"
          aria-labelledby="waitlist-form-title"
        >
          <div className="waitlist-form-head">
            <span className="eyebrow">EARLY ACCESS / 001</span>
            <span className="waitlist-live-label">
              <span className="status-dot is-live" /> OPEN
            </span>
          </div>
          {joined ? (
            <output className="waitlist-success" aria-live="polite">
              <div className="waitlist-success-mark">
                <Check size={20} />
              </div>
              <p className="eyebrow">REQUEST RECEIVED</p>
              <h2>You’re on the list.</h2>
              <p>
                We’ll send the first drop time, what to prepare, and your
                invitation when BOUGHT opens.
              </p>
              <div className="waitlist-email-line">
                <Mail size={14} /> {email}
              </div>
            </output>
          ) : (
            <>
              <h2 id="waitlist-form-title">Be there for the first drop.</h2>
              <p className="waitlist-form-copy">
                Leave your email for early access. You are not buying a position
                yet—just reserving a place to enter the first market.
              </p>
              <form onSubmit={joinWaitlist} className="waitlist-form">
                <label htmlFor="waitlist-email">EMAIL ADDRESS</label>
                <div className="waitlist-input-row">
                  <Input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-describedby={
                      error ? 'waitlist-error' : 'waitlist-note'
                    }
                  />
                  <Button type="submit">
                    JOIN <ArrowRight size={15} />
                  </Button>
                </div>
                {error ? (
                  <p className="waitlist-error" id="waitlist-error">
                    {error}
                  </p>
                ) : null}
                <p className="waitlist-note" id="waitlist-note">
                  No payment. No position created. Launch updates only.
                </p>
              </form>
            </>
          )}
        </section>
      </section>

      <section className="waitlist-explainer" aria-labelledby="how-title">
        <div className="waitlist-section-heading">
          <div>
            <p className="eyebrow">WHAT HAPPENS INSIDE</p>
            <h2 id="how-title">A simple market rhythm.</h2>
          </div>
          <p>
            Not a feed. Not a raffle. A position you choose, fund, and hold.
          </p>
        </div>
        <div className="waitlist-step-grid">
          {steps.map((step) => (
            <article className="waitlist-step" key={step.number}>
              <div className="waitlist-step-top">
                <span>{step.number}</span>
                <span>{step.label}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="waitlist-cycle" aria-labelledby="cycle-title">
        <div className="waitlist-cycle-graphic" aria-hidden="true">
          <div className="waitlist-cycle-block waitlist-cycle-live">
            <strong>12H</strong>
            <span>AUCTION LIVE</span>
          </div>
          <div className="waitlist-cycle-arrow">
            <ArrowRight size={17} />
          </div>
          <div className="waitlist-cycle-block waitlist-cycle-locked">
            <strong>12H</strong>
            <span>LOCKED EXPOSURE</span>
          </div>
          <div className="waitlist-cycle-arrow">
            <ArrowRight size={17} />
          </div>
          <div className="waitlist-cycle-block waitlist-cycle-drop">
            <strong>00:00</strong>
            <span>UTC DROP</span>
          </div>
        </div>
        <div className="waitlist-cycle-copy">
          <p className="eyebrow">THE GLOBAL CLOCK</p>
          <h2 id="cycle-title">Everyone gets a few hours.</h2>
          <p>
            The market is coordinated by UTC, not one country’s morning. When
            the auction is live somewhere, the same ladder is live everywhere.
            Your local time can differ; the room does not.
          </p>
          <div className="waitlist-cycle-meta">
            <Clock3 size={14} /> NEXT MARKET TIME WILL BE SENT TO THE WAITLIST
          </div>
        </div>
      </section>

      <section className="waitlist-faq" aria-labelledby="faq-title">
        <div className="waitlist-section-heading">
          <div>
            <p className="eyebrow">BEFORE YOU JOIN</p>
            <h2 id="faq-title">Know what you’re signing up for.</h2>
          </div>
          <Trophy size={20} className="waitlist-heading-icon" />
        </div>
        <div className="waitlist-faq-grid">
          {faq.map((item) => (
            <article className="waitlist-faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="waitlist-footer">
        <div>
          <span className="brand-dot" /> BOUGHT / THE GLOBAL ATTENTION EXCHANGE
        </div>
        <span>EARLY ACCESS / UTC-NATIVE / 2026</span>
      </footer>
    </main>
  );
}
