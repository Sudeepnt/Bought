/* oxlint-disable jsx-a11y/prefer-tag-over-role -- CSS grid preserves a compact responsive data table. */
import { ArrowUpRight, Globe2, TrendingUp } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';

const indexRows = [
  ['UNPOPULAR OPINION', '$18,200', '+6.5%', '162'],
  ['BEEF', '$18,047', '+6.0%', '184'],
  ['CHAOS', '$17,832', '+6.4%', '28'],
  ['I WAS WRONG', '$16,940', '+4.8%', '141'],
  ['THE RANT', '$15,870', '+3.9%', '118'],
];

export default function GlobalIndexPage() {
  return (
    <MarketPageShell
      active="index"
      eyebrow="GLOBAL INDEX / UTC-NATIVE"
      title="The room at a glance."
      description="One scorecard for every active category. The index does not split the room by country."
    >
      <section className="route-stat-grid" aria-label="Global index summary">
        <div className="route-stat-card hot-stat">
          <span>GLOBAL POSITION VALUE</span>
          <strong>$184.6K</strong>
          <em>
            <TrendingUp size={14} /> +4.2% / 24H
          </em>
        </div>
        <div className="route-stat-card">
          <span>ACTIVE BIDS</span>
          <strong>1,155</strong>
          <em>13 CATEGORIES</em>
        </div>
        <div className="route-stat-card">
          <span>LIVE COUNTRIES</span>
          <strong>184</strong>
          <em>
            <Globe2 size={14} /> ONE LADDER
          </em>
        </div>
        <div className="route-stat-card">
          <span>NEXT DROP</span>
          <strong>00:00</strong>
          <em>UTC / DAILY</em>
        </div>
      </section>

      <section className="route-panel index-panel">
        <div className="route-panel-head">
          <div>
            <span className="eyebrow">MARKET MOVERS</span>
            <h2>Highest positions across the floor.</h2>
          </div>
          <span className="route-live">
            <i /> LIVE DATA
          </span>
        </div>
        <div
          className="index-table"
          role="table"
          aria-label="Global category index"
        >
          <div className="index-table-head" role="row">
            <span>MARKET</span>
            <span>LEADING BID</span>
            <span>24H</span>
            <span>BIDS</span>
            <span />
          </div>
          {indexRows.map(([market, bid, change, bids], index) => (
            <div className="index-table-row" role="row" key={market}>
              <span>
                <b>{String(index + 1).padStart(2, '0')}</b>
                {market}
              </span>
              <strong>{bid}</strong>
              <em>
                <ArrowUpRight size={14} /> {change}
              </em>
              <span>{bids}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    </MarketPageShell>
  );
}
