import type { ReactNode } from 'react';
import { ArrowUpRight, Bell, Clock3 } from 'lucide-react';

import { MarketTopbar, type MarketPage } from '@/components/market-topbar';

export function MarketPageShell({
  active,
  eyebrow,
  title,
  description,
  bare = false,
  children,
}: {
  active: MarketPage;
  eyebrow: string;
  title: string;
  description: string;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`market-shell dashboard-shell route-market-shell ${bare ? 'category-only-shell' : ''}`}>
      <div className="scanlines" aria-hidden="true" />
      {!bare && <MarketTopbar active={active} />}
      <div className="route-page">
        {!bare && (
          <section className="dashboard-status-row route-status-row" aria-label="Market status">
            <div className="status-countdown dashboard-panel">
              <div className="countdown-icon"><Clock3 size={28} /></div>
              <div className="countdown-label"><strong>NEXT DROP</strong><span>UTC / MARKET RESET</span></div>
              <div className="countdown-value"><strong>07 : 59 : 16</strong><span><b>HOURS</b><b>MINUTES</b><b>SECONDS</b></span></div>
            </div>
            <div className="next-position dashboard-panel">
              <div><span className="dashboard-eyebrow">{eyebrow}</span><strong>{title}</strong><p>{description}</p></div>
              <div className="next-position-mark"><Bell size={16} /><span>EXPOSURE OPEN</span></div>
            </div>
            <div className="total-panel dashboard-panel">
              <div><span className="dashboard-eyebrow">TODAY&apos;S TOTAL</span><strong>₹4,71,220</strong></div>
              <div><span className="dashboard-delta">↑ +23%</span><span>vs yesterday</span></div>
            </div>
          </section>
        )}

        {!bare && (
          <div className="live-feed dashboard-panel route-live-feed">
            <span className="live-feed-label"><i /> LIVE FEED</span>
            <span><b>Rahul K.</b> took #4 in <strong>BEEF</strong> <em>· ₹6,200</em> <small>· 12s ago</small></span>
            <span><b>Priya M.</b> entered <strong>MONEY</strong> <em>· ₹4,100</em> <small>· 21s ago</small></span>
            <span><b>Arjun S.</b> moved to #2 in <strong>BUILDING</strong> <em>· ₹8,900</em> <small>· 31s ago</small></span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </div>
        )}

        <header className="route-intro dashboard-panel">
          <div className="dashboard-section-head"><span><i /> {eyebrow}</span><span>GLOBAL MARKET / UTC</span></div>
          <div className="route-intro-copy">
            <div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="route-intro-market"><span>GLOBAL MARKET</span><strong>₹1,84,32,220</strong><em>+23% TODAY</em></div>
          </div>
        </header>
        {children}

        <footer className="dashboard-footer route-dashboard-footer">
          <div className="footer-brand"><span className="brand-wordmark">BOUGHT</span><span>Real attention. Real opinions. Real value.</span></div>
          <div className="footer-stats"><span><b>2,843</b><small>Total Drops</small></span><span><b>1,27,500</b><small>Total Views</small></span><span><b>8,410</b><small>Active Users</small></span></div>
          <div className="footer-links"><a href="/how-it-works">About</a><a href="/how-it-works">How it works</a><a href="/categories">Categories</a><a href="/how-it-works">Terms</a><a href="/how-it-works">Privacy</a><a href="/how-it-works">Contact</a></div>
        </footer>
      </div>
    </main>
  );
}
