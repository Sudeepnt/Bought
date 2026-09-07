'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  AlarmClock,
  BarChart3,
  Bell,
  ChevronRight,
  Eye,
  Play,
  Users,
} from 'lucide-react';

import { MarketTopbar } from '@/components/market-topbar';
import { ProfileAvatar } from '@/components/profile-avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const leaderboard = [
  ['Ananya R.', '@ananyabuilds', 'UNPOPULAR OPINION', '₹11,400', 'AR', 'coral'],
  ['Arjun S.', '@arjunsays', 'BUILDING', '₹8,900', 'AS', 'green'],
  ['Priya M.', '@priyamakes', 'MONEY', '₹6,200', 'PM', 'orange'],
  ['Rahul K.', '@rahulbuilds', 'BEEF', '₹6,200', 'RK', 'blue'],
  ['Karan V.', '@karanv', 'UNPOPULAR OPINION', '₹4,800', 'KV', 'purple'],
];

const activity = [
  ['Rahul K.', 'took #4 in', 'BEEF', '₹6,200', '12s ago', 'RK', 'blue'],
  ['Priya M.', 'entered', 'MONEY', '₹4,100', '21s ago', 'PM', 'orange'],
  ['Arjun S.', 'moved to #2 in', 'BUILDING', '₹8,900', '31s ago', 'AS', 'green'],
  ['Karan V.', 'outbid in', 'UNPOPULAR OPINION', '₹11,500', '45s ago', 'KV', 'purple'],
  ['Someone just joined', 'from', 'Bengaluru', '', '1m ago', 'SJ', 'coral'],
];

const trending = [
  ['I switched from Notion to Anytype. Here’s why.', '₹9,200', 'WHY I SWITCHED', '1:36', 'RK', 'blue'],
  ['We spent ₹50,000 on LinkedIn ads. Here are the results.', '₹7,800', 'SHOW THE RECEIPTS', '2:12', 'PM', 'orange'],
  ['Is Claude still worth $30 when Kimi K3 does it for $3?', '₹6,400', 'WORTH IT?', '1:48', 'EC', 'green'],
  ['Roast my landing page. Be brutal.', '₹5,900', 'TEARDOWN', '2:05', 'AS', 'coral'],
  ['You said AI can replace SDRs. Prove it.', '₹5,900', 'PROVE IT?', '1:22', 'KV', 'purple'],
  ["Reacting to Y Combinator's new AI fund.", '₹4,600', 'REACT', '3:14', 'AR', 'blue'],
];

function Money({ value }: { value: string }) {
  return <span className="dashboard-money">{value}</span>;
}

function Avatar({ initials, tone = 'coral' }: { initials: string; tone?: string }) {
  return <ProfileAvatar initials={initials} className={`dashboard-avatar avatar-${tone}`} />;
}

function Delta({ value, down = false }: { value: string; down?: boolean }) {
  return (
    <span className={`dashboard-delta ${down ? 'is-down' : ''}`}>
      {down ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
      {value}
    </span>
  );
}

export default function Home() {
  const [now, setNow] = useState(() => new Date(0));
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewSent, setReviewSent] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    const target = new Date(now);
    target.setUTCHours(0, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
    const seconds = Math.floor((target.getTime() - now.getTime()) / 1000);
    return {
      totalSeconds: Math.max(0, seconds),
      hours: Math.floor(seconds / 3600).toString().padStart(2, '0'),
      minutes: Math.floor((seconds % 3600) / 60).toString().padStart(2, '0'),
      seconds: (seconds % 60).toString().padStart(2, '0'),
    };
  }, [now]);

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewText.trim()) return;
    setReviewSent(true);
    setReviewText('');
  }

  return (
    <main className="market-shell dashboard-shell">
      <div className="scanlines" aria-hidden="true" />
      <MarketTopbar active="floor" />

      <div className="dashboard-wrap">
        <section className="dashboard-status-row dashboard-status-panel" aria-label="Market status">
          <div className="total-panel dashboard-panel">
            <div><span className="dashboard-eyebrow">TODAY&apos;S TOTAL</span><strong>₹4,71,220</strong></div>
            <div><Delta value="+23%" /><span>vs yesterday</span></div>
          </div>
          <div className="next-position dashboard-panel">
            <div><span className="dashboard-eyebrow">THE OPEN POSITION</span><strong>BE THE NEXT #1</strong><p>Get the most visibility for your message.</p></div>
            <div className="next-position-mark"><Bell size={17} /><span>EXPOSURE OPEN</span></div>
          </div>
          <div className={`status-countdown dashboard-panel ${countdown.totalSeconds < 3600 ? 'is-urgent' : ''}`}>
            <div className="countdown-icon"><AlarmClock size={40} strokeWidth={1.8} /></div>
            <div className="countdown-label"><strong>NEXT DROP</strong><span>BIDDING STARTS IN</span></div>
            <div className="countdown-value"><strong>{countdown.hours} : {countdown.minutes} : {countdown.seconds}</strong><span><b>HOURS</b><b>MINUTES</b><b>SECONDS</b></span></div>
          </div>
        </section>

        <div className="live-feed dashboard-panel">
          <span className="live-feed-label"><i /> LIVE FEED</span>
          <div className="live-feed-viewport" aria-label="Continuously updating live feed">
            <div className="live-feed-track">
              {[...activity, ...activity].map(([name, action, category, amount, time], index) => (
                <span key={`${name}-${time}-${index}`}><b>{name}</b> {action} <strong>{category}</strong> {amount && <em>· {amount}</em>} <small>· {time}</small></span>
              ))}
            </div>
          </div>
          <button type="button" aria-label="Open live feed"><ChevronRight size={15} /></button>
        </div>

        <section className="dashboard-top-grid">
          <article className="leader-spot dashboard-panel">
            <div className="dashboard-section-head"><span>TOP POSITION RIGHT NOW <i /> LIVE</span></div>
            <div className="leader-visual">
              <div className="leader-portrait"><img src="/ananya-rao-hero.png" alt="Ananya Rao, current leader" /></div>
              <div className="leader-overlay">
                <strong className="leader-rank">#1</strong>
                <span className="leader-category">UNPOPULAR OPINION</span>
                <Money value="₹11,400" />
                <div className="leader-metrics"><span>14,201 VIEWS</span><Delta value="6 OUTBID" /></div>
                <p>“Your design<br />system is a<br />productivity<br />theatre.”</p>
                <div className="leader-person"><strong>ANANYA R.</strong><span>@ananyabuilds</span><small>Founder · DesignOps</small></div>
                <button className="hero-play" type="button" onClick={() => setVideoPlaying((value) => !value)} aria-label={videoPlaying ? 'Pause video take' : 'Play video take'}>{videoPlaying ? 'Ⅱ' : <Play size={22} fill="currentColor" />}</button>
                <a className="leader-cta" href="/categories" aria-label="Take this spot for ₹11,500"><span>TAKE THIS SPOT</span><strong>₹11,500</strong></a>
              </div>
            </div>
          </article>

          <section className="leaderboard-panel dashboard-panel">
            <div className="dashboard-section-head"><span>TODAY&apos;S LEADERBOARD</span><a href="/global-index">VIEW ALL</a></div>
            <div className="leaderboard-list">
              {leaderboard.map(([name, handle, category, price, initials, tone], index) => (
                <button className={`leaderboard-row ${index === 0 ? 'is-top' : ''}`} type="button" key={name}>
                  <span className="leaderboard-rank">{index + 1}</span>
                  <Avatar initials={initials} tone={tone} />
                  <span className="leaderboard-person"><strong>{name}</strong><small>{handle}</small></span>
                  <span className="leaderboard-category">{category}</span>
                  <strong className="leaderboard-price">{price}</strong>
                </button>
              ))}
            </div>
            <a className="panel-footer-link" href="/global-index">VIEW FULL BOARD <ArrowUpRight size={13} /></a>
          </section>

          <section className="activity-dashboard dashboard-panel">
            <div className="dashboard-section-head"><span>LIVE ACTIVITY</span><select aria-label="Activity filter"><option>ALL</option><option>POSITION MOVES</option><option>NEW ENTRIES</option></select></div>
            <div className="activity-dashboard-list">
              {activity.map(([name, action, category, amount, time, initials, tone]) => (
                <button className="activity-dashboard-row" type="button" key={`${name}-${time}`}>
                  <Avatar initials={initials} tone={tone} />
                  <span><strong>{name}</strong><small>{action} <b>{category}</b></small>{amount && <em>{amount}</em>}</span>
                  <time>{time}</time>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="dashboard-mid-grid dashboard-mid-grid-compact">
          <section className="revenue-dashboard dashboard-panel">
            <div className="dashboard-section-head"><span>TOTAL REVENUE <small>(ALL TIME)</small></span></div>
            <Money value="₹1,84,32,220" />
            <div className="revenue-chart" aria-label="Revenue chart"><span style={{ height: '22%' }} /><span style={{ height: '31%' }} /><span style={{ height: '38%' }} /><span style={{ height: '49%' }} /><span style={{ height: '62%' }} /><span style={{ height: '82%' }} /></div>
            <div className="revenue-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
            <small className="chart-note">365 DAYS · 12 CATEGORIES · 1 MARKET</small>
          </section>

          <div className="dashboard-side-stack">
            <section className="club-dashboard dashboard-panel">
              <span className="club-crown">♛</span><strong>THE BOUGHT CLUB</strong><p>Founding members get monthly slots, priority access and a permanent badge.</p><span className="club-price">₹— <small>/ MONTH</small></span><a href="/waitlist">JOIN THE CLUB</a>
            </section>

            <article className="review-dashboard dashboard-panel">
              <div className="review-dashboard-body">
                <ProfileAvatar initials="JB" className="review-avatar" alt="Arnav, Indie Hacker" />
                <div className="review-copy">
                  <p>&ldquo;This platform cuts through the fake noise. Love it.&rdquo;</p>
                  <span>— Arnav, Indie Hacker</span>
                </div>
              </div>
              <Dialog open={reviewOpen} onOpenChange={(open) => { setReviewOpen(open); if (open) setReviewSent(false); }}>
                <DialogTrigger className="review-add-trigger" type="button">ADD A REVIEW</DialogTrigger>
                <DialogContent className="review-dialog">
                  <DialogHeader>
                    <DialogTitle>Share your BOUGHT review</DialogTitle>
                    <DialogDescription>Tell the room what feels different about having a real position on the ladder.</DialogDescription>
                  </DialogHeader>
                  {reviewSent ? (
                    <div className="review-success">Review sent. Thanks for adding your voice to the room.</div>
                  ) : (
                    <form className="review-form" onSubmit={submitReview}>
                      <label htmlFor="review-text">Your review</label>
                      <textarea id="review-text" value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="What do you think of BOUGHT?" maxLength={280} required />
                      <DialogFooter className="review-dialog-footer">
                        <button type="submit" disabled={!reviewText.trim()}>SEND REVIEW</button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </article>
          </div>
        </section>

        <section className="trending-dashboard dashboard-panel">
          <div className="dashboard-section-head"><span>TRENDING DROPS</span><a href="/categories">VIEW ALL</a></div>
          <div className="trending-row">
            {trending.map(([title, price, tag, duration, initials, tone]) => (
              <article className="trending-card" key={title}>
                <div className={`trend-thumb avatar-${tone}`}><Avatar initials={initials} tone={tone} /><span>{duration}</span></div>
                <h3>{title}</h3><span className={`trend-tag tone-${tone}`}>{tag}</span><strong>{price}</strong>
              </article>
            ))}
            <button className="trending-next" type="button" aria-label="Next trending drops"><ChevronRight size={22} /></button>
          </div>
        </section>

        <footer className="dashboard-footer">
          <div className="footer-brand"><span className="brand-wordmark">BOUGHT</span><span>Real attention. Real opinions. Real value.</span></div>
          <div className="footer-stats"><span><BarChart3 size={17} /><b>2,843</b><small>Total Drops</small></span><span><Eye size={17} /><b>1,27,500</b><small>Total Views</small></span><span><Users size={17} /><b>8,410</b><small>Active Users</small></span></div>
          <div className="footer-links"><a href="/how-it-works">About</a><a href="/how-it-works">How it works</a><a href="/categories">Categories</a><a href="/how-it-works">Terms</a><a href="/how-it-works">Privacy</a><a href="/how-it-works">Contact</a></div>
        </footer>
      </div>
    </main>
  );
}
