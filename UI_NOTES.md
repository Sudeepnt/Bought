# Bought. Daily — UI notes

`public/` is the final front end: the newspaper (Today), the audio edition (Listen), the advertiser auction (Advertise) and an in-app build spec (For developers, `#spec`). Stories, video, audio, translations and the archive come from the funnel (`pipeline/funnel/README.md`); the rest is simulated in the browser until there are services behind it. Keep this UI.

## Run it

From the project root: `~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000` (it supports the Range requests video seeking needs, and runs `/admin`). No build step, no dependencies. Fonts are self-hosted in `fonts/` (the same files Google Fonts served), with system fallbacks; `fonts/fonts.css?v=` is the link to bump if they change.

Deep links: `#paper`, `#radio`, `#advertise`, `#spec`. In production add `#paper/p3` for a page.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | App shell: app bar, the four views, tab bar, reader, sheet, overlay, toasts |
| `styles.css` | Design tokens (day and night), type system, every component, motion |
| `js/data.stories.js` | Sections, writers and the empty lists an issue fills |
| `js/issue.js` | Loads `issues/index.json` and `issues/<date>/issue.json`, language switching |
| `js/data.template.js` | The fixed newspaper template, weekday themes, the 6 + 8 ad spots, reserves, auction rules, lifecycle, FAQ |
| `js/core.js` | Helpers, IST clock, day/night, router, app shell, scroll motion, toasts, soft fade-in (`Fade`), sheet |
| `js/media.js` | Story video (the funnel's files), broadcast ads (person + generated thumbnail), overlay player |
| `js/paper.js` | Renders the issue, ad slots, classifieds, polls, reactions, reader, and `Pager` (which section is on screen, the section colour, jumping to a section or ad spot) |
| `js/data.comments.js` | Sample readers and comment text for discussions → replace with `GET /threads/:id/comments` |
| `js/discuss.js` | Discussions: threads under every story and today's open thread on page 8. Nested replies, votes, Best/Top/New, collapse, reply, edit, delete, report, "Most discussed" on the front page |
| `js/radio.js` | Listen view and mini player, playing the funnel's episode |
| `js/auction.js` | Auction engine: minimums, auto-raise, soft close, holds, settlement, reports. **Every function here becomes a server operation.** |
| `js/advertise.js` | Advertise view: issue picker, template map, spot detail, bid flow, My bids, rules, invoice, report |
| `js/spec.js` | The `#spec` page: template, spots, rules, states, jobs, edge cases, data model, API, tokens, stack |
| `js/live.js` | Connects Advertise to `backend/` when it has keys: market, sign-in, bids, upload, wallet, winning ads |
| `js/live/` | Built browser bundle from `backend/client/` (Mux upload and playback, Supabase sign-in, recording aids). Do not edit by hand |
| `js/main.js` | Boot and global events |

## Today: one continuous paper

Today is eight sections in a fixed order (`PAGES` in `js/data.template.js`): 1 Front, 2–7 one section each, 8 clips, classifieds, today's open thread and the back page. It reads as one continuous paper on a darker desk. As you scroll into a section, the paper and the desk fade (about 1.1 s) to a light wash of that section's colour (`--sec`, set by `Pager.spy`; `--tint` is 7% by day, 9% at night). Each section opens with a running head and a large section title.

There are no page-turn animations anywhere. The numbered strip under the app bar follows the section on screen and jumps with a smooth scroll (‹ › and ← → do the same). Views, Advertise tabs and the next story in the reader fade in (`Fade.in` in `js/core.js`). With reduced motion, jumps are instant and nothing fades.

## Issues and the archive

The masthead's top-right control steps to the previous or next issue (‹ ›) and opens the archive calendar (this week's issues as quick picks, then a month grid with each day's edition colour). Reading an older issue shows a "From the archive" bar with a link back to today. Only dates the funnel has published can be opened; `Issue.go(date)` loads `issues/<date>/issue.json`.

## Advertiser links

Every display ad carries small links to the advertiser's website (required), a social profile (LinkedIn, X, Instagram, YouTube and so on; optional) and an email address (optional). They're collected in the ad step of the bid flow, checked (a bare `yourcompany.com` is accepted and saved as `https://…`), previewed, listed on the review step, and shown on the ad as chips; on phones the top banner shows them as icons. Links open in a new tab with `rel="noopener sponsored"`; email opens the mail app. Helpers: `adLinks`, `normUrl`, `hostOf`, `socialName` in `js/media.js`.

## Wallet credits for advertisers

Advertisers bid from prepaid credits (1 credit = $1), topped up by UPI or card from the wallet chip on Advertise or inline at the review step. A live bid sets aside its maximum plus tax; being outbid frees those credits at once; at close the winners' credits are deducted and an invoice is issued. A bid that free credits can't cover is refused with the exact shortfall and one-tap top-ups. Free credits can be withdrawn. Engine: `availCredits`, `heldTotal`, `addCredits`, `withdrawCredits` and the check at the top of `placeBid` in `js/auction.js`; UI: `Wallet` and `walletBox` in `js/advertise.js`.

## How this issue was made

A quiet strip above the back-page footer shows the funnel's real counts for the issue: items read, duplicates removed, filtered out, on brief, published and videos, with a small read → unique → on brief → published funnel (`stats` in `issue.json`).

## Screen sizes

Tested at phone (390), iPad portrait (820), iPad landscape (1180), laptop (1440) and desktop (1920). The column is 1,120 px, widening to 1,280 px from 1,600 px. Layout rules live in the "RESPONSIVE PASS" block at the end of `styles.css`:

- **Phone (≤600):** one column; the top three become compact rows with a square thumbnail; the masthead date shortens to fit one line; short poll answers sit side by side.
- **iPad portrait (601–860):** the lead story and feature packages stay side by side; the top three sit in three columns.
- **iPad landscape, laptop, desktop:** full six-column grid. Listen puts the player beside the lineup, and Advertise puts its key numbers beside the pitch.
- **No dead space:** text-only stories show a short gist (and, from 1,025 px, "Why it matters") so they match the video stories beside them. Where a gap remains, `Paper.balance()` moves the section's "In brief" list into that column; it reruns on resize and after fonts load.

## Discussions

Every story has a Reddit-style thread under it (open the story, or tap the comment count on any card), and page 8 carries **Today's open thread** for the whole issue, with pinned notes and replies from the Bought. Desk. Writers answer in their own stories with an Author badge. Readers vote up or down, sort by Best, Top or New, collapse threads, reply at any depth, edit or delete their own comments (replies stay), and report others. Guardrails: name required once, 2–1,000 characters, no links in a first comment, the same restricted-claims check as ads, a short rate limit. No ads ever appear inside discussions. In the prototype, a reply to your comment arrives about 14 seconds later as a notice that opens straight to it. Data model, endpoints and rules: `#spec`.

## The auction in one paragraph

Each issue has 6 display spots and 8 classified lines, in fixed template positions. Every display spot takes a video (recorded in the browser or on the phone camera, or uploaded; anything over 60 seconds is cut at 60 s and the advertiser picks which minute runs) or an image; classifieds are text only. Bidding for an issue opens 7 days ahead at 07:00 IST and closes at 22:00 IST the night before; a bid in a spot's last 5 minutes extends that spot by 5 minutes, hard stop 22:30. The highest bid wins each display spot (ties go to the earlier bid); the 8 highest classified bids run, ordered by bid. Auto-raise bids for you up to a hidden maximum. A hold for the maximum plus tax is placed at bid time (2 days before close for far-out issues); at close, winners are charged the winning price and every other hold is released. Ads are reviewed within 2 hours and always before 04:00 IST; unfixed ads by 05:00 forfeit to the runner-up. Full rules and edge cases: `#spec`.

## What's simulated

The auction, wallet, ad upload and delivery reports below stay simulated only until `backend/.env` has its keys (`backend/README.md`). Then `js/live.js` mirrors the server into `AU`, the prototype controls and rival bidders turn off, and the bid sheet gains a Sign in step (Continue with Google, or a code by email; `auth/done.html` is where Google's window lands) and the code step. Live, an ad spot nobody won stays empty, or shows Bought's own ad if `HOUSE_ADS` in `js/data.template.js` has one for it; the sample advertisers appear only in the local simulation and as format examples on the Advertise page. Comments and votes are sample data either way.


Rival bidders, the clock ("Prototype controls" fast-forward and close), payments, delivery reports, comments and their counts, and poll and reaction counts. Advertisers are fictional. Stories, videos, audio and translations are real.

## Production checklist

- Auction service: per-auction row lock on every bid, server timestamps, websocket events (`bid`, `auto_raise`, `outbid`, `extended`, `closed`, `settled`, `review`).
- Scheduled jobs: open D−7, close watch from 21:55, settle on each spot's close, capture/release, payment-failure fallback (30 min), hold placement at D−2 for far-out bids, review SLA, 04:00 final check, 05:00 runner-up swap, 07:00 publish, D+1 reports.
- Payments: authorise-then-capture (UPI one-time mandate or card authorisation in India; manual-capture card payments elsewhere). Check hold expiry rules with your provider.
- Advertiser video: managed upload, transcoding and captions; render thumbnail text server-side over a frame.
- Accounts: business verification (GSTIN in India), one account per business, linked-account detection.
- Engagement: one vote and one reaction per reader, rate-limited.
- Accessibility: keep the keyboard paths (Esc closes, arrows move between stories in the reader), focus return, and reduced-motion handling.
