import { ArrowUpRight, Eye, Zap } from 'lucide-react';

import { MarketPageShell } from '@/components/market-page-shell';
import { ProfileAvatar } from '@/components/profile-avatar';

const watchlist = [
  ['01', 'AN', 'Ananya Rao', 'BEEF', '$18,200', '8.2k'],
  ['02', 'RK', 'Rahul K.', 'BEEF', '$18,047', '8.1k'],
  ['03', 'KV', 'Karan V.', 'CHAOS', '$17,832', '8.1k'],
  ['04', 'MC', 'Maya Chen', 'THE RANT', '$17,741', '8.0k'],
  ['05', 'AS', 'Arjun S.', 'BUILDING', '$15,620', '6.4k'],
  ['06', 'PM', 'Priya M.', 'THE ASK', '$14,900', '5.8k'],
  ['07', 'EC', 'Ethan Cole', 'THE PITCH', '$14,240', '5.2k'],
  ['08', 'NP', 'Nia Patel', 'UNPOPULAR OPINION', '$13,860', '4.9k'],
];

export default function WatchlistPage() {
  return (
    <MarketPageShell
      active="watchlist"
      eyebrow="YOUR WATCHLIST / 08 POSITIONS"
      title="Keep the movers close."
      description="The eight positions worth returning for before the next close."
    >
      <section className="watchlist-layout">
        <div className="route-panel watchlist-panel">
          <div className="route-panel-head">
            <div>
              <span className="eyebrow">TRACKED POSITIONS</span>
              <h2>Watch the chase.</h2>
            </div>
            <span className="watchlist-count">
              <Eye size={14} /> 08 LIVE
            </span>
          </div>
          <div className="watchlist-table">
            {watchlist.map(
              ([rank, initials, name, category, bid, watching]) => (
                <button className="watchlist-row" type="button" key={name}>
                  <span className="watch-rank">{rank}</span>
                  <ProfileAvatar initials={initials} className="watch-avatar" />
                  <span className="watch-player">
                    <strong>{name}</strong>
                    <em>{category}</em>
                  </span>
                  <strong>{bid}</strong>
                  <span className="watching">
                    <Eye size={13} />
                    {watching}
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ),
            )}
          </div>
        </div>
        <aside className="watchlist-callout">
          <span className="eyebrow">MARKET ALERT</span>
          <Zap size={23} />
          <h2>Four watched positions moved in the last hour.</h2>
          <p>
            Stay close to the tape. The best time to act is before the room
            agrees.
          </p>
          <button type="button">
            SET AN ALERT <ArrowUpRight size={14} />
          </button>
        </aside>
      </section>
    </MarketPageShell>
  );
}
