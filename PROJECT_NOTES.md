# BOUGHT — Project Notes (read this instead of re-exploring the code)

Bought is one project: a daily AI-made tech, AI and business newspaper, its news-to-video funnel, its admin desk and its ad auction, running on one VPS. Repo: github.com/Sudeepnt/Bought. Updated 2026-11-15.

## The day

| When | What runs |
| --- | --- |
| 06:00 UTC | The publish clock puts the day's issue live and emails subscribers; the day's winning ads go public with it |
| The next few hours (`reader_hours` in admin Settings, default 4) | Readers come first: automatic fetching and translating wait |
| After that, when the machine is quiet | Fetch the sources, choose the stories (rules now; jev, the user's decision model, plugs into `funnel_evaluator_command`), make the explainer videos and audio, translate; the user checks it all in the desk and clicks Publish |
| Any time | Advertisers bid in points for the coming issues. Bidding for an issue closes at 05:45 UTC on its day (05:50 at the latest after late bids), leaving 10 minutes before it goes live |

Funnel jobs run one at a time, at the lowest CPU and disk priority (nice 19, ionice idle), and automatic ones also wait while the 1-minute load is above 70% of the cores.

Coming, planned by the user: a business-development module that brings readers by itself (emails, social posts). It will be another service on the same VPS.

## Layout

| Folder | What |
| --- | --- |
| `public/` | The site: plain HTML, CSS and JS with no build step. The UI is final (the co-founder's bought-daily): never change how it looks. `UI_NOTES.md` describes it |
| `public/issues/` | Written by the funnel at publish; git-ignored |
| `public/fonts/` | Self-hosted Google Fonts files (OFL), the same files Google served |
| `public/js/live.js`, `public/js/live/` | The Advertise page talking to `backend/`; `js/live/` is built from `backend/client/` (`npm run build:client`), never edited by hand |
| `pipeline/` | Python: sources, funnel, audio, translations, the admin desk, mail, the publish clock, and `server.py` that ties them together. `pipeline/funnel/README.md` |
| `pipeline/explainer/` | The explainer engine: story videos drawn by code from a reusable library (drawings, scene templates, 20 themes, portraits); Claude Haiku plans, code checks, Kokoro speaks, Chromium renders. `pipeline/explainer/README.md` |
| `backend/` | Node: Bought's Supabase, Stripe, Razorpay and Upstash code with no pages, plus ad videos on Cloudflare R2: the ad auction, wallet and ad delivery. `backend/README.md` |
| `deploy/` | Caddy, systemd, backups, `setup.sh` for the VPS |

## Run it

```sh
~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000     # site on :8000, the desk on :8100 (private), the clock, the backend if npm-installed
PYTHON=~/.cache/bought/funnel-venv/bin/python npm test                   # every test: Python, backend, typecheck
```

Keys on this Mac live in `backend/.env` (git-ignored); the pipeline reads it too (`pipeline/r2.py`). On the VPS everything is in `/etc/bought/bought.env`.

`pipeline/.venv` is broken; use `~/.cache/bought/funnel-venv`. Voice (Kokoro) and translation (M2M100) run from `~/.cache/bought/tts/venv`; config.yaml names them as `$BOUGHT_HOME/...` (default `~/.cache/bought`). The explainer renderer uses `playwright-core` from the root `package.json`; portraits need `potrace`. `ANTHROPIC_API_KEY` (in `backend/.env` here, `/etc/bought/bought.env` on the VPS) turns on the AI scene plans; without it every video uses the plan made by rules.

Without keys in `backend/.env` the Advertise page runs its local simulation. Comments, poll and reaction counts, and unsold ad spots are sample data either way.

## Production

`deploy/setup.sh` on Ubuntu 24.04 (see README). Caddy serves `public/` itself (HTTPS, HTTP/2 and 3, zstd/gzip, the cache rules) and passes HTML pages, `/api/*`, `/confirm`, `/unsubscribe`, `/healthz` to the Python server on 127.0.0.1:8000. The desk (admin) is a second listener on 127.0.0.1:8100, never public: SSH tunnel or Tailscale, password plus authenticator code. Security model: `SECURITY.md`. Cache rules (`cache_policy` in `pipeline/server.py`, mirrored in `deploy/Caddyfile`): `?v=` files, hashed bundle chunks and fonts for a year; issue media an hour; HTML and JSON always revalidated. Bump `?v=` on any CSS or JS you change. Daily backups of `pipeline/data` at 03:30, 14 kept.

## Media on Cloudflare R2

With the `R2_*` keys set, publishing uploads each story's explainer (`issues/<date>/explainers/<id>/`: `16x9.mp4`, `9x16.mp4`, their posters, `captions.vtt`, `plan.json`) and the podcast (`issues/<date>/media/`) to the R2 bucket (a year's immutable cache, `?v=` versioned) and `issue.json` points readers at `R2_PUBLIC_URL`; unchanged files are skipped (MD5 against R2's ETag) and the site's own copies are removed. Card pictures, share cards and JSON stay on the site. The paper's video spots play the 16:9 explainer and the clips rail the 9:16 one. Old issues already on R2 keep their files under `media/`. Without the keys the site serves the media itself, as before. Ad videos and pictures go from the browser straight to R2 on a signed PUT link (one key, one content type, the exact size, two hours for videos); pictures live under `ad-images/<user>/<ad>/` and are checked and copied by the server before they can run, so Supabase holds no files at all under `ads/<ad>/<take>.mp4|webm`; the backend then checks the file itself (size, type, ffprobe: picture of at least 240 px, sound, 1 s to 10 min, codecs every browser plays) and readers play it from a 10-minute signed link. No transcoding: HEVC/ProRes uploads are refused with a reason. The S3 keys can only read and write objects; bucket settings (CORS: the site's origin, PUT/GET/HEAD, header content-type) are set in the Cloudflare dashboard.

## The dashboard and reader counts

The desk opens on Dashboard (`/admin/dashboard`, 7/30/90 days): alerts (failing sources, failed jobs, an issue close to its time and not ready, mail, backups, disk, withdrawals to pay), headline numbers, readers per day (new and returning), visits by hour against the publish time, referrers, devices, views, languages, time zones, top stories, the news funnel from scraped to read, scraped per day, sources, issues, email, ads (`bought_ad_stats` through the backend's `admin/stats`) and the server. All news (`/admin/news`, CSV export) lists every stored story, what happened to it and how readers took it. Code: `pipeline/dashboard.py` (queries), `pipeline/dash_pages.py` (HTML), `pipeline/charts.py` (server-drawn SVG; the only script is the tooltip, allowed by its hash).

Reader numbers come from `public/js/stats.js` posting to `/api/hit`, counted by `pipeline/analytics.py` into `pipeline/data/stats.db`: no cookie, no id, no IP stored; a visitor is a daily-salted hash forgotten the next day; the page keeps only its first-visit date to tell new readers from returning ones. Days are IST. Only daily totals are kept long term.

## Keep a copy (export and import everything)

Dashboard → "Keep a copy" downloads one zip of everything the server holds: every database in `pipeline/data` (SQLite's own snapshot, integrity-checked), pictures, podcasts, translations, logs, all of `pipeline/out`, and `public/issues`, `public/s`, `public/share`, with `manifest.json` listing each file's size and SHA-256 and each table's row count. Not in it: `admin_password.txt`, `admin_session_key` (they stay with the machine, so an import never signs you out) and the keys in `bought.env`. "Import a copy" uploads it, checks every file first and changes nothing until you confirm; then databases are written in place by SQLite's backup (the server keeps running) and the folders are swapped. Paths from another machine are rewritten to this one. What was there before goes to `restore-points/` (one kept), so the import can be undone from the dashboard. No import while a job runs; the clock, new jobs and the reader counter pause during it. Code: `pipeline/copies.py`, routes `/admin/copy/*` in `server.py`, tests `pipeline/tests/test_copies.py`.

## Ads backend in one paragraph

Six display spots and eight classified lines per issue. Bidding opens D-7 06:00 UTC and closes D 05:45 UTC (a 5-minute soft close up to 05:50), 10 minutes before the issue goes live at 06:00 UTC; the times are in `bought_ad_times` and assume that publish time. Sign-in is an email code, Google or Facebook, then (new accounts only) a name and a role; no payment details. Bids are in points: every new email gets 100 free points once (`bought_ad_open_account`), more cost $1 each (Stripe in USD, Razorpay UPI in INR at `USD_INR_RATE`, plus 18% GST in India, charged at purchase). Every spot starts at 1 point, +1 point steps. Until a payment provider is set nothing is sold and buying shows blurred as "Coming soon"; Stripe needs only `STRIPE_SECRET_KEY` (the server asks Stripe whether each checkout was paid; the webhook is optional, for refunds and disputes). Free points are spent first and can't be withdrawn; unused bought points can, paid by hand from the desk. No review: an ad is `ready` when its video or picture is in; at go-live ready winners run and a winner whose ad isn't ready gets every point back. No face detection (MediaPipe removed); the recorder keeps a microphone check. Schema: `backend/supabase/migrations/`.

## History

- Bought began as a separate Vinext/React app (video broadcast marketplace with a magazine). On 2026-11-05 its non-UI code moved into `backend/`; on 2026-11-06 its pages were deleted (commit 9b937f1) and the newspaper repo (Bt-Newspaper) was merged into this one with its history. The old app is in git history before 9b937f1 if anything needs looking up.
- Bt-Newspaper on GitHub is the newspaper's old repo; this repo replaces it.

## Planned: engagement stats and badges (requested, not built)

Measure how long readers spend on each story and show LinkedIn-style signals ("Most viewed", impression counts): impression (card >=50% visible for >=1 s), dwell seconds, video watch seconds. Needs a small collector endpoint plus SQLite and a nightly stage that turns counts into badges. Anonymous random id, no personal data; counts show only once a story has enough views.

## Explainer videos (2026-11-15)

The old video system (a still picture plus headline plus voice in 20 reel themes, `prime_render.cjs`, and the older presenter/avatar videos) was deleted. Every story video is now an explainer drawn by code: `pipeline/explainer/` (README there). The library is built once and reused: 44 drawings with named parts, 18 scene templates with real 9:16 and 16:9 layouts, the 20 approved themes as data, and traced line portraits (`python -m pipeline explainer portrait add`). The only AI is one Claude Haiku Batch API call per story (the scene plan, ids limited to the library) and the local Kokoro voice. Code checks every quote, number, date and name against the sources before rendering; a plan that fails twice waits on the desk (`/admin/explainers`) with no video. Rendering is deterministic (every animation set to the frame's time), runs at the lowest priority and waits out the reader hours. Tests: `pipeline/tests/test_explainer.py`.
