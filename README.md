# Bought. Daily

The newspaper site is plain HTML, CSS and JavaScript in `public/`, with no build step. `pipeline/` finds the news and makes the videos, audio and translations, then publishes each issue into `public/issues/`.

- Today, Listen, Advertise and the build notes (`#spec`) are views of one page: `public/index.html`. UI notes: `UI_NOTES.md`.
- The funnel, from source to published issue: `pipeline/funnel/README.md`.

Run everything (the site, the admin page, subscribing and the publish clock) in one process:

```sh
~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8000
```

- Site: http://localhost:8000/
- Admin: http://localhost:8000/admin. The password is `BOUGHT_ADMIN_PASSWORD`, or the file `pipeline/data/admin_password.txt`, created with a random one on first start.

The daily flow is in admin: fetch the news, review it (Ignore, Use today, Use tomorrow), finalize, look over the list, Publish. Videos and audio are made from that list, and the issue goes live and is emailed at the time set in Settings. `funnel run` still does it all at once with no review.

Email needs `BOUGHT_SMTP_HOST` and `BOUGHT_SMTP_FROM` (plus `BOUGHT_SMTP_USER`, `BOUGHT_SMTP_PASS`, `BOUGHT_SMTP_PORT` if your mail service asks for them). See `pipeline/mailer.py`.

## Advertising backend

`backend/` is Bought's Mux, Supabase and payments code with no pages. Run `npm install` in `backend/` once; `pipeline serve` then starts it. Setup, keys and webhooks are in `backend/README.md`. Ads are reviewed at `/admin/ads`.
