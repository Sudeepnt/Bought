# BOUGHT — Project Notes (read this instead of re-exploring the code)

Bought is one project: a daily AI-made tech, AI and business newspaper, its news-to-video funnel, its admin desk and its ad auction, running on one VPS. Repo: github.com/Sudeepnt/Bought. Updated 2026-11-06.

## The day

| When | What runs |
| --- | --- |
| 06:00 UTC | The publish clock puts the day's issue live and emails subscribers; the day's winning ads go public with it |
| The next few hours (`reader_hours` in admin Settings, default 4) | Readers come first: automatic fetching and translating wait |
| After that, when the machine is quiet | Fetch the sources, choose the stories (rules now; jev, the user's decision model, plugs into `funnel_evaluator_command`), make the videos and audio, translate; the user checks it all in the desk and clicks Publish |
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
| `pipeline/` | Python: sources, funnel, videos, audio, translations, the admin desk, mail, the publish clock, and `server.py` that ties them together. `pipeline/funnel/README.md` |
| `backend/` | Node: Bought's Mux, Supabase, Stripe, Razorpay and Upstash code with no pages: the ad auction, wallet and ad delivery. `backend/README.md` |
| `deploy/` | Caddy, systemd, backups, `setup.sh` for the VPS |

## Run it

```sh
~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000     # site on :8000, the desk on :8100 (private), the clock, the backend if npm-installed
PYTHON=~/.cache/bought/funnel-venv/bin/python npm test                   # every test: Python, backend, typecheck
```

`pipeline/.venv` is broken; use `~/.cache/bought/funnel-venv`. Voice (Kokoro) and translation (M2M100) run from `~/.cache/bought/tts/venv`; config.yaml names them as `$BOUGHT_HOME/...` (default `~/.cache/bought`). The video renderer uses `playwright-core` from the root `package.json`.

Without keys in `backend/.env` the Advertise page runs its local simulation. Comments, poll and reaction counts, and unsold ad spots are sample data either way.

## Production

`deploy/setup.sh` on Ubuntu 24.04 (see README). Caddy serves `public/` itself (HTTPS, HTTP/2 and 3, zstd/gzip, the cache rules) and passes HTML pages, `/api/*`, `/confirm`, `/unsubscribe`, `/healthz` to the Python server on 127.0.0.1:8000. The desk (admin) is a second listener on 127.0.0.1:8100, never public: SSH tunnel or Tailscale, password plus authenticator code. Security model: `SECURITY.md`. Cache rules (`cache_policy` in `pipeline/server.py`, mirrored in `deploy/Caddyfile`): `?v=` files, hashed bundle chunks and fonts for a year; issue media an hour; HTML and JSON always revalidated. Bump `?v=` on any CSS or JS you change. Daily backups of `pipeline/data` at 03:30, 14 kept.

## Ads backend in one paragraph

Six display spots and eight classified lines per issue. Bidding opens D-7 06:00 UTC and closes D 05:45 UTC (a 5-minute soft close up to 05:50), 10 minutes before the issue goes live at 06:00 UTC; the times are in `bought_ad_times` and assume that publish time. Bids are in points: every new email gets 100 free points once (`bought_ad_open_account`), more cost $1 each (Stripe in USD, Razorpay UPI in INR at `USD_INR_RATE`, plus 18% GST in India, charged at purchase). Every spot starts at 1 point, +1 point steps. Free points are spent first and can't be withdrawn; unused bought points can, paid by hand from the desk. No review: an ad is `ready` when its video or picture is in; at go-live ready winners run and a winner whose ad isn't ready gets every point back. No face detection (MediaPipe removed); the recorder keeps a microphone check. Schema: `backend/supabase/migrations/`.

## History

- Bought began as a separate Vinext/React app (video broadcast marketplace with a magazine). On 2026-11-05 its non-UI code moved into `backend/`; on 2026-11-06 its pages were deleted (commit 9b937f1) and the newspaper repo (Bt-Newspaper) was merged into this one with its history. The old app is in git history before 9b937f1 if anything needs looking up.
- Bt-Newspaper on GitHub is the newspaper's old repo; this repo replaces it.

## Planned: engagement stats and badges (requested, not built)

Measure how long readers spend on each story and show LinkedIn-style signals ("Most viewed", impression counts): impression (card >=50% visible for >=1 s), dwell seconds, video watch seconds. Needs a small collector endpoint plus SQLite and a nightly stage that turns counts into badges. Anonymous random id, no personal data; counts show only once a story has enough views.
