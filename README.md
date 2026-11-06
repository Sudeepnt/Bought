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
- Desk (admin): http://localhost:8100/admin, a separate private port. The password is `BOUGHT_ADMIN_PASSWORD`, or the file `pipeline/data/admin_password.txt`, created with a random one on first start. Set `BOUGHT_ADMIN_TOTP` to also ask for an authenticator code.

The daily flow is in the desk: fetch the news, review it (Ignore, Use today, Use tomorrow), finalize, look over the list, Publish. Videos and audio are made from that list, and the issue goes live and is emailed at the time set in Settings (06:00 UTC unless changed). For `reader_hours` after that, automatic work waits so readers get the server. `funnel run` still does it all at once with no review.

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
4. Fill the keys in `/etc/bought/bought.env` (mail, and the ad providers from `backend/.env.example`), then `sudo systemctl restart bought`. The desk password is in that file; the script shows a QR code for your authenticator app once.

To update: `git pull` in `/srv/bought`, then run `setup.sh` again.

| | |
| --- | --- |
| Logs | `journalctl -u bought -f`; requests in `/var/log/caddy/bought.log` |
| Health | `https://your.domain/healthz` gives `{"ok": true}` for an uptime monitor; the desk's `/healthz` also says whether ads are live |
| Backups | `/srv/bought/backups`, daily at 03:30, the newest 14 kept (`deploy/backup.py`) |
| Data | `pipeline/data` (databases, admin secrets), `public/issues` (published issues) |

## The desk

The desk (admin) is never on the public address: `https://your.domain/admin` is a plain "not found". It listens on 127.0.0.1:8100 inside the server, and you sign in with the password plus a code from an authenticator app.

- From a laptop: `ssh -N -L 8100:127.0.0.1:8100 root@your.domain`, then open http://localhost:8100/admin. The SSH key is the first lock.
- From a phone: install Tailscale on the server and the phone, run `sudo tailscale serve --bg --https=443 http://127.0.0.1:8100` on the server, and add the server's Tailscale name (e.g. `bought.tail1234.ts.net`) to `BOUGHT_DESK_HOSTNAMES` in `/etc/bought/bought.env`. Only devices in your tailnet can reach it.

How the whole thing is protected: `SECURITY.md`.

## How it is served

Caddy serves the site's files itself, with HTTPS, HTTP/2 and HTTP/3, compression and long cache times for versioned files. The Python server behind it on 127.0.0.1:8000 handles the HTML pages (each with its security policy), subscribing, the ads API and webhooks; the same process runs the private desk on 127.0.0.1:8100, the publish clock, and the ads backend as its child.
