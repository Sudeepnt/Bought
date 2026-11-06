/* Bought. Daily — "For developers": the handoff spec, rendered from the same data the prototype runs on */

const SPEC_MODEL=[
 ["Thread · Comment","thread {id = storyId or issue:date, locked} · comment {id, threadId, parentId, readerId, displayName, body ≤1000, createdAt, editedAt, deletedAt, score, status (visible · reported · removed), role (reader · author · desk)}"],
 ["CommentVote · Report","vote {commentId, readerId, value ±1} (one per reader, changeable) · report {commentId, readerId, reason, createdAt}"],
 ["Issue","date, number, themeIndex, status (draft · scheduled · live), publishedAt"],
 ["Story","id, issueDate, section, size (lead · top · xl · m · s · brief), media (auto · thumb · reveal · none), videoSeconds, readMinutes, writer, kicker, title, dek, gist[], body[], why, source {name, url}"],
 ["Poll · Vote","storyId or 'pulse', question, options[], counts[] · vote {pollId, readerId or deviceId, option} (one per reader)"],
 ["Reaction","storyId, kind (useful · surprising · worrying · skeptical), readerId; counts are aggregated"],
 ["Spot","id, name, zone, format (media: video or image · classified), shape, reserveBase, increment, seats (8 for classifieds)"],
 ["Auction","id, issueDate, spotId, opensAt, closesAt, hardCloseAt, extensions, highBid, bidCount, status (scheduled · open · extended · closed · settled)"],
 ["Bid","id, auctionId, advertiserId, mode (auto · exact), amount (current price), max, status (leading · outbid · in · out · won · lost · withdrawn), creativeId, createdAt"],
 ["Wallet · Ledger","wallet {advertiserId, balance, currency=credits (1 = $1)} · ledger entry {id, walletId, kind (topup · win · withdraw · refund), amount, bidId?, invoiceId?, providerRef?, createdAt}. Set-aside = Σ max × (1 + tax) of the advertiser's leading bids, computed under the auction lock"],
 ["Creative","id, advertiserId, kind (video · image), videoUrl or imageUrl, durationSeconds, trimStartSeconds (video runs trimStart → trimStart + min(duration, 60)), websiteUrl (required), socialUrl, contactEmail, thumbnailText, presenterLine, headline, line, link, brand {bg, fg}, checks[], review (pending · approved · changes_requested), reviewerNote"],
 ["Advertiser","id, business, email, country, gstin, verifiedAt, status (active · suspended until)"],
 ["Invoice","id, bidId, amount, tax, total, currency, issuedAt"],
 ["Report","auctionId, readers, plays, averageWatchSeconds, clicks"]
];
const SPEC_API=[
 ["GET","/threads/:id/comments?sort=best|top|new&cursor=","Top-level comments with replies three deep; cursor pages 5 threads at a time"],
 ["POST","/threads/:id/comments","New comment or reply {parentId?, body}; rate-limited, link rule, restricted-claims check"],
 ["PATCH · DELETE","/comments/:id","Edit or delete your own comment; a deleted comment keeps its replies"],
 ["PUT","/comments/:id/vote","{value: 1 | -1 | 0}; score updates by websocket"],
 ["POST","/comments/:id/report","Hides it for the reporter; 3 reports send it to the desk queue"],
 ["GET","/issues/:date","The issue: stories, polls, and the winning ad in every spot"],
 ["GET","/auctions?date=YYYY-MM-DD","Every spot for an issue: high bid, bid count, minimum, closesAt"],
 ["GET","/auctions/:id","One auction with anonymised history (handles, amounts, times)"],
 ["POST","/auctions/:id/bids","{mode, amount | max, creativeId} → 201 bid · 409 below minimum · 423 closed · 402 not enough free credits (body: shortfall)"],
 ["POST","/creatives","Multipart upload or in-browser recording → creative + automatic checks. Video over 60 s is accepted and cut to 60 s from trimStart (server-side transcode); images JPG/PNG/WebP up to 10 MB"],
 ["PATCH","/creatives/:id","Edit before 04:00 IST on issue day; returns to review"],
 ["GET","/me/bids","My open bids and results"],
 ["GET · POST","/me/wallet · /me/wallet/topups","Balance, set-aside, free credits and ledger · start a UPI or card top-up; credits land on the provider's success webhook"],
 ["POST","/me/wallet/withdrawals","Withdraw free credits to the verified bank account (3–5 working days)"],
 ["GET","/me/invoices/:id · /me/reports/:auctionId","Invoice and delivery report"],
 ["WS","/live?date=…","Events: bid, auto_raise, outbid, extended, closed, settled, review"],
 ["POST","/polls/:id/votes · /stories/:id/reactions","Reader engagement (rate-limited, one per reader)"]
];
const SPEC_JOBS=[
 ["07:00 IST daily","Open auctions for the issue 7 days out (D−7)"],
 ["21:55 IST","Start close watch. Each spot closes at 22:00 unless a bid arrived in its last 5 minutes; then it closes 5 minutes after the latest bid, hard stop 22:30"],
 ["On each spot's close","Settle under a lock: rank bids, write a 'win' ledger entry deducting the winning price + tax from the winner's wallet, free every other set-aside, issue the invoice, notify everyone"],
 ["Every 15 min","Human review queue (SLA 2 hours). 04:00 IST final check; 05:00 IST swap in the runner-up if a winning ad is still not approved"],
 ["07:00 IST","Publish the issue"],
 ["09:00 IST, D+1","Delivery reports and invoice emails"]
];
const SPEC_EDGE=[
 "Comments: Best ranks by score with a gentle recency decay; your own new comment shows first to you for 30 minutes; pinned desk notes always lead.",
 "Comments: no ads inside discussions, ever. Threads lock at 23:59 IST the day after the issue; replies to you arrive as a notice with a link straight to the reply.",
 "Two bids at the same amount: the earlier one wins (bids are timestamped by the server under the auction lock).",
 "Auto-raise: the winner pays the second-highest maximum plus one increment, capped at their own maximum. Maximums are never shown.",
 "Bids can't be lowered or withdrawn. Withdrawals happen only when an ad fails review and isn't fixed by 05:00 IST, or the auction is cancelled.",
 "Soft close is per spot. A late bid on the top banner doesn't extend the half page.",
 "Credits: a bid is accepted only if free credits cover its maximum plus tax (minus what that same bid already sets aside). Outbid bids free their credits at once; withdrawals can only take free credits, so a live bid is always fully funded.",
 "Linked accounts (same payment instrument, device or GSTIN) bidding on the same spot are flagged and voided.",
 "Unsold spots and forfeits run house ads. Bought. never bids on its own spots.",
 "An ad is never placed beside a story about the advertiser; the section's stories are reordered instead.",
 "If the issue fails to publish or an ad doesn't render, the credits are refunded to the wallet automatically.",
 "All times are stored in UTC and shown in IST. The prototype's clock can be fast-forwarded; production can't."
];
function specHTML(){
 const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
 const tokens=[["--paper","Page","#f3eee4","#232427"],["--sheet","Panels","#faf7f0","#2a2b2f"],["--ink","Text","#2a2723","#e8e4dc"],["--muted","Secondary text","#7c766b","#9c978e"],["--rule","Rules","#e3dbcd","#37383d"],["--accent","Brand red (the dot)","#b4432b","#e27a5c"],["--ad-bg","Ad tint","#efe8db","#2b2a2b"]];
 const type=[["Wordmark","Fraunces 600, optical size 144","52–104 px","Masthead only"],["Display","Fraunces 500–600","22–30 px","Section titles, big numbers, classifieds heading"],["Headline","Newsreader 500","16.5–44 px","Story headlines, ad headlines"],["Body","Newsreader 400, line height 1.6–1.7","15–18.5 px","Summaries, reader text, classified lines"],["Interface","Geist 500–600","11–15 px","Navigation, labels, buttons, forms"],["Data","Geist Mono 500","11–24 px","Prices, timers, video times, counts"]];
 return `<div class="spec">
 <section class="spec-hero rv"><span class="eyebrow">For developers</span><h1>Bought. Daily — build spec</h1>
  <p>This prototype is the reference for the product: every screen, state and rule you see works here, simulated in the browser. This page lists what to build behind it. The source ships as plain HTML, CSS and JavaScript; the data files hold the template, spots, themes and rules, so the UI and this spec never disagree.</p>
  <div class="spec-files"><b>Files</b><code>index.html</code><code>styles.css</code><code>js/data.stories.js</code><code>js/data.template.js</code><code>js/core.js</code><code>js/media.js</code><code>js/paper.js</code><code>js/radio.js</code><code>js/auction.js</code><code>js/advertise.js</code><code>js/spec.js</code><code>js/main.js</code></div></section>

 <section class="rv"><h2>Screens</h2><div class="tblw"><table><thead><tr><th>Screen</th><th>Link</th><th>What it does</th></tr></thead><tbody>
  <tr><td>Today</td><td><code>#paper</code></td><td>The issue: masthead, one banner, lead, briefs, top stories, poll, numbers, six sections, clips, classifieds. Stories open in a reader panel.</td></tr>
  <tr><td>Listen</td><td><code>#radio</code></td><td>The issue as one audio episode; a mini player follows you back to the paper.</td></tr>
  <tr><td>Advertise</td><td><code>#advertise</code></td><td>Tabs: Spots (issue picker, template map, spot detail), My bids (status, credits set aside, results, invoices, reports), How it works (timeline, rules, questions).</td></tr>
  <tr><td>Bid flow</td><td>sheet</td><td>Issues → Bid → Ad → Payment (first time only) → Review → Done. Raise: Bid → Review. Edit ad: Ad.</td></tr>
  <tr><td>For developers</td><td><code>#spec</code></td><td>This page.</td></tr></tbody></table></div></section>

 <section class="rv"><h2>The template</h2><p>Every issue uses the same blocks in the same order. Only the stories, the ads and the weekday theme change.</p><div class="tblw"><table><thead><tr><th>#</th><th>Block</th><th>Type</th><th>Ad spots</th><th>Notes</th></tr></thead><tbody>${TEMPLATE.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.name)}</td><td>${b.kind}</td><td>${(b.spots||[]).map(s=>`<code>${s}</code>`).join(" ")||"—"}</td><td>${esc(b.note)}</td></tr>`).join("")}</tbody></table></div></section>

 <section class="rv"><h2>The fixed page template</h2><p>Every issue has the same eight pages in the same order; only the stories, the edition name and the accent change. The issue reads as one continuous paper: as you scroll into a section, the paper and desk fade to that section's colour (about 1 s). The page strip follows the section on screen and jumps with a smooth scroll. There are no page-turn animations anywhere.</p><div class="tblw"><table><thead><tr><th>Page</th><th>Contents</th><th>Ad spots</th></tr></thead><tbody>${PAGES.map((p,n)=>{const ks=Object.entries(SPOT_PAGE).filter(([k,v])=>v===n||(k==="cls"&&n===7)).map(([k])=>k);const c=CATS[n-1];return `<tr><td><b>${n+1} · ${esc(p.name)}</b></td><td>${n===0?"Masthead, lead story and video, Today in 30 seconds, top 3, The Pulse, the day in numbers, In this issue":n===7?"60-second clips, classifieds 9–12, subscribe, footer":`${LAYOUT[c.name].main.length} stories and in brief`}</td><td>${ks.length?ks.map(k=>`<code>${k}</code>`).join(" "):"—"}</td></tr>`}).join("")}</tbody></table></div><p class="spec-note">Deep links use <code>#paper/p3</code> in production and scroll to that section.</p></section>

 <section class="rv"><h2>Ad spots</h2><p>6 display spots and 8 classified lines per issue. Every display spot takes a video (recorded in the browser or uploaded; anything over 60 seconds is cut at 60 s, and the advertiser picks the start) or an image. Classifieds are text only. Reserve = base × weekday multiplier, rounded to $10.</p><div class="tblw"><table><thead><tr><th>Spot</th><th>Format</th><th>Where</th><th>Reserve (base)</th><th>Increment</th><th>Winners</th></tr></thead><tbody>${SPOT_ORDER.map(k=>{const s=SPOTS[k];return `<tr><td><code>${k}</code> ${esc(s.name)}</td><td>${FORMATS[s.fmt].name}${s.shape==="vert"?" (9:16)":s.shape==="wide"?" (21:9)":""}</td><td>${esc(s.zone)}</td><td>${usd(s.reserve)}</td><td>${usd(s.inc)}</td><td>${s.seats||1}</td></tr>`}).join("")}</tbody></table></div>
  <p class="spec-note">Weekday multipliers: ${DAY_MULT.map((m,i)=>`${days[i]} ×${m}`).join(" · ")}</p></section>

 <section class="rv"><h2>Daily themes</h2><div class="themes">${THEMES.map((t,i)=>`<button type="button" class="theme-sw${EDITION===t?" on":""}" data-edition="${i}" style="--th:${t.hue}"><i></i><b>${t.day}</b><span>${esc(t.name)}</span><small>${esc(t.lede)}</small></button>`).join("")}</div><p class="spec-note">Tap a day to preview its theme on the paper. The theme tints the edition name and polls; the layout never changes.</p></section>

 <section class="rv"><h2>Auction rules</h2><div class="rules-grid compact">${RULES.map((r,i)=>`<section class="rule"><h3><span>${String(i+1).padStart(2,"0")}</span>${esc(r.h)}</h3><ul>${r.p.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`).join("")}</div></section>

 <section class="rv"><h2>Lifecycle and states</h2>
  <ol class="life">${LIFECYCLE.map(([t,h,s,key])=>`<li class="${key||""}"><b>${t}</b><span>${h}</span>${s?`<small>${s}</small>`:""}</li>`).join("")}</ol>
  <div class="states"><div><h4>Auction</h4><p><code>scheduled</code> → <code>open</code> → <code>extended</code>* → <code>closed</code> → <code>settled</code></p></div><div><h4>Bid</h4><p><code>leading</code> ⇄ <code>outbid</code> (display) · <code>in</code> ⇄ <code>out</code> (classifieds) → <code>won</code> | <code>lost</code></p></div><div><h4>Hold</h4><p><code>verified</code> → <code>authorised</code> → <code>captured</code> | <code>released</code> | <code>failed</code></p></div><div><h4>Ad</h4><p><code>pending</code> → <code>approved</code> | <code>changes_requested</code> → <code>pending</code></p></div></div></section>

 <section class="rv"><h2>Scheduled jobs</h2><div class="tblw"><table><thead><tr><th>When</th><th>Job</th></tr></thead><tbody>${SPEC_JOBS.map(([a,b])=>`<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div></section>

 <section class="rv"><h2>Edge cases the rules close</h2><ul class="spec-list">${SPEC_EDGE.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>

 <section class="rv"><h2>Data model</h2><div class="tblw"><table><thead><tr><th>Entity</th><th>Fields</th></tr></thead><tbody>${SPEC_MODEL.map(([a,b])=>`<tr><td><b>${a}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div></section>

 <section class="rv"><h2>API</h2><div class="tblw"><table><thead><tr><th></th><th>Endpoint</th><th>Purpose</th></tr></thead><tbody>${SPEC_API.map(([m,p,d])=>`<tr><td><code>${m}</code></td><td><code>${esc(p)}</code></td><td>${esc(d)}</td></tr>`).join("")}</tbody></table></div></section>

 <section class="rv"><h2>Design system</h2>
  <h3 class="spec-h3">Colour · day and night</h3><div class="swatches">${tokens.map(([v,l,d,n])=>`<div><span class="sw2"><i style="background:${d}"></i><i style="background:${n}"></i></span><b>${l}</b><code>${v}</code><small>${d} · ${n}</small></div>`).join("")}</div>
  <h3 class="spec-h3">Type</h3><div class="tblw"><table><thead><tr><th>Role</th><th>Face</th><th>Size</th><th>Used for</th></tr></thead><tbody>${type.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <ul class="spec-list"><li>Spacing on an 8 px rhythm; story grid of 6 columns with 28 px gutters; content width 1,120 px; side gutter at least 16 px plus safe-area insets.</li><li>Radius 8 px for panels and ads, 999 px for pills. Ads use the same grid as stories, a faint tint (<code>--ad-bg</code>) and one small "Sponsored" mark.</li><li>Motion: blocks settle 14 px upward as they enter the screen (0.7 s, ease-out); sheets and the reader slide in; poll bars fill. All motion stops under reduced-motion settings.</li><li>Day/night follows the device; the sun/moon button overrides it and is remembered.</li></ul></section>

 <section class="rv"><h2>Suggested stack</h2><ul class="spec-list"><li>Front end: Next.js or plain server-rendered pages using these CSS variables and components. Keep each block of the template as a component that takes its data.</li><li>Back end: Postgres. Lock the auction row (<code>SELECT … FOR UPDATE</code>) for every bid; push events over websockets (Redis pub/sub).</li><li>Payments: authorise-then-capture. In India, a UPI one-time mandate or card authorisation (for example Razorpay); elsewhere, card payments with manual capture (for example Stripe). Check each provider's hold-expiry and pre-debit-notice rules.</li><li>Video: a managed host for upload, transcoding and captions (for example Mux or Cloudflare Stream). Render the thumbnail text server-side over a frame of the video.</li><li>Accounts: email sign-in plus business verification (GSTIN for India) before an advertiser's first ad runs.</li></ul></section>

 <section class="rv"><h2>What's simulated in the prototype</h2><div class="tblw"><table><thead><tr><th>Area</th><th>In the prototype</th><th>To build</th></tr></thead><tbody>
  <tr><td>Stories</td><td>50 summaries of 22–25 Oct 2026 reports, with source links</td><td>The editorial pipeline and CMS</td></tr>
  <tr><td>Video and audio</td><td>Simulated players with captions; illustrated presenters</td><td>Real streams, uploads, captions</td></tr>
  <tr><td>Bids and rivals</td><td>Rival bids every few seconds; state resets on reload</td><td>Auction service, accounts, websockets</td></tr>
  <tr><td>Time</td><td>"Prototype controls" fast-forward to close and publish</td><td>Scheduled jobs above</td></tr>
  <tr><td>Money</td><td>Wallet top-ups, deductions, withdrawals, invoices and reports are mock</td><td>Payment provider, tax invoices, reporting</td></tr>
  <tr><td>Engagement</td><td>Votes and reactions saved in this browser</td><td>Server counts, one per reader</td></tr></tbody></table></div></section>
 </div>`;
}
const Spec={render(){$("spec").innerHTML=specHTML()}};
VIEW_HOOKS.spec={enter(){Spec.render()}};
