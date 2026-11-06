# BOUGHT — Project Notes (read this instead of re-exploring the code)

Written 2026-10-20 from a one-time read of both repos. Re-check the code only for details not covered here.

## The merge (2026-11-05)

Bought and the newspaper are one product now. The newspaper's UI in `public/` is final and never changes. Bought's non-UI code lives in `backend/` (read `backend/README.md`): Mux, Supabase, Stripe, Razorpay, Upstash and the recording logic, with every page, component and CSS file left behind. The Advertise page's existing buttons call it through `public/js/live.js`. With no keys in `backend/.env` the page keeps its simulation. The old `./Bought` repo was not changed; it is a reference only, and sections below that describe its pages and routes are history.

## The big picture

| | **Bought** (main product) | **Bt-Newspaper** (design prototype) |
|---|---|---|
| Repo | github.com/Sudeepnt/Bought | github.com/Sudeepnt/Bt-Newspaper |
| Local path | `./Bought/` (nested git repo) | `./` (this folder's root) |
| Stack | React 19 + Vinext (App Router-compatible, **not** Next.js) + Vite, Nitro → Vercel | Plain static HTML/CSS/JS, no build, no deps |
| Purpose | Video "broadcast" marketplace/auction + magazine archive | Mobile newspaper + podcast UI, designed *before* merging into Bought |

**Strategy:** the daily newspaper is the hook that brings readers to the site; the broadcast (video upload) side is the product. Bt-Newspaper is where the newspaper UX gets designed and polished; once final, it gets ported into Bought.

---

## 1. Bought. Daily (root of this folder)

Run: `~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000` -> http://localhost:8000/. No build. `vercel.json` serves `public/`, but issues are generated and git-ignored, so a host must run the funnel (or receive `public/issues/`).

The final UI (from the co-founder, replaced the earlier UI on 2026-11-05) is one page with four views: Today, Listen, Advertise, `#spec`. `UI_NOTES.md` describes it.

Real, from the funnel: stories, sections, videos, pictures, the audio episode, translated headlines and summaries, the archive, link-preview pages (`public/s/<id>/`), "How this issue was made".
Admin at `/admin` (password): `pipeline/server.py`, `desk.py`, `admin_pages.py`, `mailer.py`; see `pipeline/funnel/README.md`. Run: `~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000`. Subscribing and email are real but need SMTP settings to send.
Still sample data in the browser (no server yet): comments, poll and reaction counts, advertisers, the auction and wallet. The footer says so.
`public/js/issue.js` loads `issues/index.json` and `issues/<date>/issue.json`; `pipeline/funnel/publish.py` writes them.

---

## 2. Bought (`./Bought/`)

Run: `npm ci && cp .env.example .env && npm run dev`. Scripts: `build`, `test` (`tsx --test tests/*.test.ts`), `typecheck`, `lint` (oxlint), `format` (oxfmt), `preflight:production`. Node ≥ 22.13. Without credentials the `/broadcast` form shows but sign-in/upload is disabled.

### Services
- **Supabase** — auth (email code sign-in), Postgres, Realtime, private thumbnail storage. Migrations in `supabase/migrations/` (apply in filename order): paid drop pipeline, capture mode, optimized public snapshot, English transcription, web push, finalized categories, push RPC hardening, free daily upload limit, free public current auction.
- **Mux** — direct uploads (UpChunk, resumable, bytes never touch the server), signed playback, auto captions + translation (10 featured languages pre-generated, others on demand).
- **Stripe / Razorpay** — optional paid "boost" in USD to rank higher; webhooks verify raw-body signature + amount + currency. Publishing itself is now **free**.
- **Upstash Redis** — atomic write rate limits (fail closed).
- Web Push (VAPID) notifications, `public/notifications-sw.js`.
- Env vars (see `.env.example`): `APP_ORIGIN, VAPID_*, SUPABASE_*, STRIPE_*, RAZORPAY_*, MUX_*, UPSTASH_*, CRON_SECRET`. Never prefix secrets with `NEXT_PUBLIC_`/`VITE_`.

### Routes (`app/`)
`/` (today's market/leaderboard, 799 lines) · `/broadcast` (record & upload) · `/review` (moderator queue) · `/categories` (2722 lines, biggest) · `/magazine` and `/magazine/[slug]` (The BOUGHT Review archive) · `/profile` · `/watchlist` · `/chat` · `/search` + `/search/[type]/[id]` · `/how-it-works` · `/terms` · `/capture-test` · `/drop` (stub). API: single catch-all `app/api/bought/[...path]/route.ts` → `handleApi` (config, drops, uploads, webhooks for stripe/razorpay/mux, `cron`, market snapshot).

### Key code
- `components/`: `drop-recorder`, `screen-recorder`, `capture-preflight` (camera/mic + MediaPipe face detect), `drop-player` (Mux player), `magazine-issue-reader`, `market-chrome`/`market-topbar`, sign-in modal steps (category, goals), `add-funds-modal`, `bought-provider`.
- `lib/`: `magazine.ts` (issue data), `recording-*` (compositor, retention, capabilities, guidance), `local-recording` (IndexedDB recovery copy), `direct-messages`, `market-notifications`, `search`, `caption-languages`, `drop-domain`; `lib/server/` = `api, config, providers, security, transcription, webhooks, push-notifications`.
- `tests/` covers api routing, DMs, drop DB (PGlite), domain, recording, push, webhooks/providers, preflight.
- `public/mediapipe/` = face-detector WASM + model; `public/magazine/*.pdf` = generated issues; `scripts/generate_magazine_pdfs.py` builds the PDFs (also into `output/pdf/`).
- `vercel.json`: strict CSP/security headers, long cache for `/mediapipe`, `/brand`, `/magazine`; daily cron `0 0 * * *` → `/api/bought/cron`.

### Business rules to remember
- Each account: **3 new Mux uploads per UTC day**; broadcasts up to 2 min (imports up to 250 MB MP4/MOV/WebM).
- Flow: record → upload to Mux + thumbnail to Supabase → Mux processing + English transcript → **human moderator** approves (`bought_moderator: true` in server-managed app metadata) → public. No auto-approval.
- Auction: market open **00:00–12:00 UTC**, order frozen at 12:00 UTC, exposure until 00:00. Rank = higher paid amount, then earliest payment confirmation, then `dropId`. Late finishers roll to next auction. DB clock is authoritative.
- Refund/dispute removes the public entry.
- Categories (rooms) seen in magazine: Beef, Chaos, Confessions, The Ask, Building, The Rant, Hiring, Indian D2C, Money I Set On Fire, Unpopular Opinion, Pitch, Wrong, Agency Row.

### Magazine ("The BOUGHT Review") — the existing newspaper-ish side in Bought
- After each 12:00 UTC lock, the next day's issue is published: one **ALL #1 cover** + one cover per category leader, permanent archive. Types in `lib/magazine.ts`: `MagazineIssue {slug, number, date, person, category, title, image, tone(blue|red|orange|green|charcoal), views, opens}`; exports `latestIssue`, `categoryIssues`, `dailyEditions`, `historyIssues`, `roomIssues`. Currently sample/static data (issue 05 "The Cost of Being Seen", Ananya Rao, 09 Sep 2026). Rendered as PDFs.
- This is **leaderboard/people-focused** (winners' covers), whereas Bt-Newspaper is a **news-focused** daily feed (tech stories). Merging them = adding the news feed/podcast as the reader-facing hook, with Spotlight placements linking to Bought broadcasts.

---

## Integration notes / likely next steps
- Bt-Newspaper is framework-free; porting into Bought means converting the `public/js` rendering into React components (new route, e.g. `/` or `/news`). The data is already real (`issues/<date>/issue.json`).
- Styling: the site uses its own `styles.css`; check Bought's `app/globals.css` for conflicts before porting.
- Bought's CSP (`vercel.json`) is strict (`default-src 'self'`) — remote images/fonts need allowlisting.
- Bought already has Mux captions/translation infra and a language list (`lib/caption-languages.ts`) that could be reused.
- `Bought/` is a nested git repo inside the Bt-Newspaper repo working tree; don't `git add` it from the parent.

---

## 3. `pipeline/` (added 2026-10-20) — newspaper content pipeline, Phase 1
Standalone Python service (own venv, `pipeline/README.md` has everything): RSS/news-sitemap sources
(`sources.yaml`) -> SQLite (`data/news.db`) -> dedupe -> score/select -> `out/feed.json` {prime, cards, glance}.
Settings in `pipeline/config.yaml` (slots 25/25/10 unconfirmed). `python -m pipeline run|show [--dry-run]`,
tests `pytest pipeline`. Phase 2 (TTS/avatar) is only planned in `pipeline/PHASE2.md`. Licenses: `pipeline/LICENSES.md`.
Run commands from the project root.

Phase 2a (2026-10-21): prime items get `script`, `audio_url`, `duration_s` via external TTS (Piper tested); see `pipeline/PHASE2.md`. Avatar video (2b) not started.

## Planned: engagement stats and badges (requested, not built)
Study how long readers actually spend on each story and show LinkedIn-style signals ("Most viewed", impression counts).
- Client measures per story: impression (card >=50% visible for >=1 s), dwell seconds (visible time, paused when the tab is hidden), video watch seconds and completion.
- Needs a collector (small endpoint + SQLite) and a nightly pipeline stage that turns counts into badges in `feed.json` (e.g. top 10% by dwell -> "Most viewed"). Hosting the collector needs the user's approval first.
- Privacy: anonymous random id, no personal data; counts are only shown once a story has enough views.
