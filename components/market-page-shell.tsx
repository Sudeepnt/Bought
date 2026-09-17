import type { ReactNode } from 'react';

import { MarketFooter } from '@/components/market-chrome';
import { MarketTopbar, type MarketPage } from '@/components/market-topbar';

export function MarketPageShell({
  active,
  eyebrow,
  title,
  description,
  showIntro = true,
  children,
}: {
  active: MarketPage;
  eyebrow: string;
  title: string;
  description: string;
  showIntro?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="market-shell dashboard-shell route-market-shell">
      <div className="scanlines" aria-hidden="true" />
      <MarketTopbar active={active} />
      <div className={`route-page${showIntro ? '' : ' route-page-no-intro'}`}>
        {showIntro && (
          <header className="route-intro dashboard-panel">
          <div className="dashboard-section-head">
            <span>
              <i /> {eyebrow}
            </span>
            <span>GLOBAL MARKET / UTC</span>
          </div>
          <div className="route-intro-copy">
            <div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="route-intro-market">
              <span>GLOBAL MARKET</span>
              <strong>$18,432,220</strong>
              <em>+23% TODAY</em>
            </div>
          </div>
          </header>
        )}
        {children}

        <MarketFooter />
      </div>
    </main>
  );
}
