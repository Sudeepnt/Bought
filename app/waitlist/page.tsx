'use client';
/* oxlint-disable next/no-html-link-for-pages */

import { useRef, useState } from 'react';
import { ArrowRight, Check, Globe2, Mail, Timer, Trophy } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

const steps = [
  {
    number: '01',
    label: 'BRING',
    title: 'Bring what matters to you.',
    copy: 'A product, project, opinion, or identity you want the world to notice.',
  },
  {
    number: '02',
    label: 'BACK',
    title: 'Put conviction behind it.',
    copy: 'Spend to move into a higher position. Your rank is visible to everyone in the room.',
  },
  {
    number: '03',
    label: 'HOLD',
    title: 'Hold the room.',
    copy: 'When the auction closes, your position stays exposed for 12 hours while the world catches up.',
  },
  {
    number: '04',
    label: 'RETURN',
    title: 'See what happens next.',
    copy: 'At the next UTC drop, rise, defend your place, or come back stronger.',
  },
];

const faq = [
  {
    question: 'What am I joining?',
    answer:
      'The founding queue for BOUGHT: a global attention exchange where people earn a public position through a shared auction.',
  },
  {
    question: 'Do I pay anything now?',
    answer:
      'No. The waitlist is free. It does not create a position or promise an outcome; it gives you first access information.',
  },
  {
    question: 'Will this change my life?',
    answer:
      'No platform can promise that. BOUGHT gives your conviction a public room; what happens after people see it depends on what you bring and what the room does with it.',
  },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);

  const chooseProvider = (domain: string) => {
    const localPart = email.trim().split('@')[0].trim();
    const nextEmail = `${localPart}@${domain}`;
    setEmail(nextEmail);
    setError('');

    requestAnimationFrame(() => {
      const input = emailInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(localPart.length, localPart.length);
    });
  };

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
    <MarketPageShell
      active="waitlist"
      eyebrow="FOUNDING ROOM / EARLY ACCESS"
      title="Take your place early."
      description="Join the founding queue and get the first drop time before the market opens."
    >
      <div className="waitlist-current-wrap">
        <section className="waitlist-hero">
          <div className="waitlist-hero-copy">
            <p className="kicker">
              <Globe2 size={13} /> FOUNDING ROOM / GLOBAL ATTENTION EXCHANGE
            </p>
            <h1>
              Be early to the
              <br />
              <em>room that remembers.</em>
            </h1>
            <p className="waitlist-lede">
              The internet is full of people doing work that never gets its
              moment. BOUGHT gives products, projects, opinions, and identities
              a public position—and puts the whole world in the same room.
            </p>
            <div className="waitlist-proof-row">
              <div>
                <strong>FIRST</strong>
                <span>DROP ACCESS</span>
              </div>
              <div>
                <strong>ONE</strong>
                <span>SHARED LADDER</span>
              </div>
              <div>
                <strong>BEFORE</strong>
                <span>THE CROWD</span>
              </div>
            </div>
          </div>

          <section
            className="waitlist-form-panel"
            aria-labelledby="waitlist-form-title"
          >
            <div className="waitlist-form-head">
              <span className="eyebrow">FOUNDING ROOM / REQUEST 001</span>
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
                <h2 id="waitlist-form-title">Take your place early.</h2>
                <p className="waitlist-form-copy">
                  If you believe your work, product, or point of view deserves a
                  room, put your name down. We’ll tell you when the first
                  auction opens and how to enter.
                </p>
                <form onSubmit={joinWaitlist} className="waitlist-form">
                  <label htmlFor="waitlist-email">EMAIL ADDRESS</label>
                  <div className="waitlist-input-row">
                    <input
                      id="waitlist-email"
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="your name"
                      aria-describedby={
                        error
                          ? 'waitlist-provider-note waitlist-error'
                          : 'waitlist-provider-note waitlist-note'
                      }
                    />
                    <button type="submit">
                      JOIN <ArrowRight size={15} />
                    </button>
                  </div>
                  <div
                    className="waitlist-provider-row"
                    id="waitlist-provider-note"
                  >
                    <span>CHOOSE YOUR PROVIDER</span>
                    <button
                      type="button"
                      className="waitlist-provider-button"
                      onClick={() => chooseProvider('gmail.com')}
                    >
                      <strong>GMAIL</strong> <span>@gmail.com</span>
                    </button>
                    <button
                      type="button"
                      className="waitlist-provider-button"
                      onClick={() => chooseProvider('yahoo.com')}
                    >
                      <strong>YAHOO</strong> <span>@yahoo.com</span>
                    </button>
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

        <section
          className="waitlist-founding-band"
          aria-labelledby="founding-title"
        >
          <div className="waitlist-founding-mark">01</div>
          <div className="waitlist-founding-copy">
            <p className="eyebrow">THE PART BEFORE THE STORY</p>
            <h2 id="founding-title">
              The first people in help decide what gets remembered.
            </h2>
          </div>
          <p>
            You are not joining to watch from the edge. You are joining to bring
            something of your own, make a claim, and find out what the room does
            with it.
          </p>
        </section>

        <section className="waitlist-explainer" aria-labelledby="how-title">
          <div className="waitlist-section-heading">
            <div>
              <p className="eyebrow">WHAT HAPPENS INSIDE</p>
              <h2 id="how-title">The ritual is simple. The feeling is not.</h2>
            </div>
            <p>
              You are not signing up to watch. You are signing up to put
              something of yours on the board.
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
            <h2 id="cycle-title">The world will not arrive at once.</h2>
            <p>
              That is the point. A global room needs a shared clock, so no
              single country owns the opening. When it is your hour, you act.
              When it is someone else’s, they see you.
            </p>
            <div className="waitlist-cycle-meta">
              <Timer size={14} /> NEXT MARKET TIME WILL BE SENT TO THE WAITLIST
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
      </div>
    </MarketPageShell>
  );
}
