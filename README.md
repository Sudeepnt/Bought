# Bought. Daily

A daily tech, AI and business newspaper made by a news funnel: it finds the stories, makes the videos, audio and translations, and publishes each issue at 06:00 UTC. Advertisers bid for spots in the coming issues.

- `public/`: the site, plain HTML, CSS and JavaScript with no build step. Today, Listen, Advertise and the build notes (`#spec`) are views of one page. UI notes: `UI_NOTES.md`.
- `pipeline/`: the funnel, the admin desk, mail and the publish clock. From source to published issue: `pipeline/funnel/README.md`.
- `backend/`: the ads (Mux, Supabase, Stripe, Razorpay, Upstash), with no pages of its own. Setup, keys and webhooks: `backend/README.md`. Ads are reviewed at `/admin/ads`.
- `deploy/`: the production setup for a VPS.

## Run it locally

```sh
npm install && npm --prefix backend install          # once
~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000
```

- Site: http://localhost:8000/
- Admin: http://localhost:8000/admin. The password is `BOUGHT_ADMIN_PASSWORD`, or the file `pipeline/data/admin_password.txt`, created with a random one on first start.

The daily flow is in admin: fetch the news, review it (Ignore, Use today, Use tomorrow), finalize, look over the list, Publish. Videos and audio are made from that list, and the issue goes live and is emailed at the time set in Settings (06:00 UTC unless changed). For `reader_hours` after that, automatic work waits so readers get the server. `funnel run` still does it all at once with no review.

Email needs `BOUGHT_SMTP_HOST` and `BOUGHT_SMTP_FROM` (plus `BOUGHT_SMTP_USER`, `BOUGHT_SMTP_PASS`, `BOUGHT_SMTP_PORT` if your mail service asks for them). See `pipeline/mailer.py`.

## Tests

```sh
PYTHON=~/.cache/bought/funnel-venv/bin/python npm test     # Python, backend and typecheck
```

The full ad journey in a real browser, with stand-ins for Supabase, Mux and Upstash: `backend/tests/e2e/` (see `backend/README.md`). GitHub Actions runs the tests on every push (`.github/workflows/test.yml`).

## Production (Ubuntu 24.04 VPS)

1. Point the domain's DNS at the server. Clone this repo to `/srv/bought`.
2. `sudo BOUGHT_DOMAIN=your.domain ./deploy/setup.sh`. It installs Python, Node 22, ffmpeg, Chromium and Caddy, the dependencies from the lock files, the systemd services and the daily backup, and gets an HTTPS certificate.
3. Copy the voice and translation models from the laptop that has them (the script prints the `rsync` lines), then run `setup.sh` again.
4. Fill the keys in `/etc/bought/bought.env` (mail, and the ad providers from `backend/.env.example`), then `sudo systemctl restart bought`. The admin password is in that file.

To update: `git pull` in `/srv/bought`, then run `setup.sh` again.

| | |
| --- | --- |
| Logs | `journalctl -u bought -f`; requests in `/var/log/caddy/bought.log` |
| Health | `https://your.domain/healthz` gives `{"ok": true, "ads": "live" / "simulated" / "down"}` for an uptime monitor |
| Backups | `/srv/bought/backups`, daily at 03:30, the newest 14 kept (`deploy/backup.py`) |
| Data | `pipeline/data` (databases, admin secrets), `public/issues` (published issues) |

Caddy serves the site's files itself, with HTTPS, HTTP/2 and HTTP/3, compression and long cache times for versioned files. The Python server behind it on 127.0.0.1:8000 handles admin, the API, webhooks and the publish clock, and runs the ads backend as its child.
