import { ArrowRight, Eye, LockKeyhole, Trophy } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

const rules = [
  ['01', 'ENTER THE AUCTION', 'Choose one category. Put money behind your position. The highest total spend leads the global ladder.'],
  ['02', 'THE LADDER MOVES', 'For twelve hours, anyone can outbid you. Every move is public, and position #1 has the biggest room.'],
  ['03', 'EXPOSURE LOCKS', 'For twelve more hours, the final order is held in public view. Your position becomes the proof.'],
];

export default function HowItWorksPage() {
  return (
    <MarketPageShell
      active="rules"
      eyebrow="THE BOUGHT MODEL"
      title="One auction. One ladder."
      description="The same global market resolves in UTC, regardless of where someone joins the room."
    >
      <section className="rules-grid">
        {rules.map(([number, title, copy], index) => (
          <article className="rule-card" key={number}>
            <span>{number}</span>
            {index === 0 ? <Trophy size={23} /> : index === 1 ? <Eye size={23} /> : <LockKeyhole size={23} />}
            <h2>{title}</h2>
            <p>{copy}</p>
            {index < rules.length - 1 && <ArrowRight className="rule-arrow" size={18} />}
          </article>
        ))}
      </section>
      <section className="route-panel schedule-panel">
        <div><span className="eyebrow">00:00—12:00 UTC</span><strong>AUCTION LIVE</strong><p>Bid to move up.</p></div>
        <div><span className="eyebrow">12:00—00:00 UTC</span><strong>LOCKED EXPOSURE</strong><p>Hold the position.</p></div>
        <div><span className="eyebrow">00:00 UTC</span><strong>THE DROP</strong><p>The next room opens.</p></div>
      </section>
    </MarketPageShell>
  );
}
