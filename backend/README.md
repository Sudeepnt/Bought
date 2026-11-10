# The backend

This is Bought's code with every page removed (the one exception is `public/auth/done.html`, where Google's sign-in window lands and closes): ad videos on Cloudflare R2, Supabase sign-in and database, Stripe and Razorpay payments, Upstash rate limits, and the browser's recording and upload logic. It has no interface of its own. The newspaper's Advertise page in `public/` calls it from its existing buttons.

`pipeline serve` starts it and forwards `/api/bought/*` to it, so the site, `/admin` and this API share one address. Until every core key in `.env` is set, `/api/bought/config` answers `live: false` and the Advertise page keeps its local simulation.

## What came from Bought

| Bought | Here |
| --- | --- |
| `lib/server/providers.ts`, `security.ts`, `config.ts`, `webhooks.ts` | Same files, adapted from one paid broadcast to one ad paid in points |
| `lib/recording-capabilities.ts`, `local-recording.ts`, `recording-retention.ts`, `webhook-signatures.ts` | Same files. Limits follow the Advertise page: 500 MB, 10 minutes uploaded, 60 seconds run |
| The recorder's sound check, wake lock, upload (no face detection) | `client/index.ts`, with no UI, uploading to R2 on a signed link. Built into `public/js/live/` by `npm run build:client` |
| `bought_drops` and its SQL functions | `bought_ads` and `bought_ad_*` in `supabase/migrations/`, plus the per-spot auction and wallet |

Left behind: all pages, components and CSS, the daily ladder and categories, screen recording (the page has no button for it), web push (it has no permission prompt), the caption and transcript jobs, human review, and face detection.

## Connect it

1. Create a Supabase project and apply `supabase/migrations`. Turn on email sign-in with `{{ .Token }}` in the email template, so readers get a code rather than a link, and set up production SMTP in Supabase Auth.
2. Cloudflare R2: create a bucket and an R2 API token with **Object Read & Write on that bucket only** (it gives the access key ID and secret). Connect a custom domain to the bucket for `R2_PUBLIC_URL` (the `r2.dev` address is rate-limited and meant for development). In the bucket's Settings > CORS policy allow the site's exact origin with methods `PUT`, `GET`, `HEAD` and header `content-type` (see below). The VPS needs `ffprobe` (`setup.sh` installs ffmpeg).
3. Create an Upstash Redis database. Writes are refused when the limiter is unavailable.
4. Copy the values into `backend/.env` (see `.env.example`), set `APP_ORIGIN` to the exact address readers use, and set `CRON_SECRET` to a long random string. Restart `pipeline serve`. `/admin/ads` lists whatever is still missing, by name.
5. Google sign-in (the "Continue with Google" button in the bid sheet): in Google Cloud, create an OAuth client (Web application) whose redirect URI is `https://<your-project>.supabase.co/auth/v1/callback`; in Supabase, Authentication > Providers > Google, paste its client ID and secret; in Authentication > URL Configuration, add `https://<your site>/auth/done.html` to the Redirect URLs. Self-hosted Supabase takes the same three values as `GOTRUE_EXTERNAL_GOOGLE_*` settings.
6. For buying points ($1 each, plus 18% GST in India): Stripe for card (USD), Razorpay for UPI (INR, at the `USD_INR_RATE` you set). Razorpay must use automatic capture.

Webhooks, on the public HTTPS address:

| Provider | Endpoint | Events |
| --- | --- | --- |
| Stripe | `/api/bought/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` |
| Razorpay | `/api/bought/webhooks/razorpay` | `payment.captured`, `refund.processed` |

R2 bucket CORS policy (Cloudflare dashboard > R2 > the bucket > Settings > CORS policy), with your site's address:

```json
[{ "AllowedOrigins": ["https://your-domain"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
```

## How an ad moves

1. **Sign in.** Google or an emailed code. The first account an email opens gets 100 free points (`bought_ad_open_account`), once.
2. **Bid.** `bought_ad_bid` enforces every rule on the page under a per-spot lock: open and close times, the 1-point reserve, 1-point steps, auto-raise, soft close, points. Bids go in before the upload, so a slow connection can't cost anyone the auction.
3. **Upload.** The video goes straight from the browser to R2 on a signed PUT link (one key under `ads/<ad>/`, one content type, two hours) and never passes through this server. A copy stays on the device until it lands, and a refresh carries on by itself. A still from the video becomes the poster. The browser then says it's done and the server checks the file in R2 itself: size up to 500 MB, the type it signed, and ffprobe over a signed link (a picture of at least 240 px each way in H.264, VP8, VP9 or AV1, a sound track, 1 second to 10 minutes). A good file makes the ad `ready`; anything else comes back as `rejected` with the reason and the file is deleted. Nothing is transcoded, so the recorder prefers MP4 (H.264 + AAC). Nobody reviews ads.
4. **Close.** Bidding for an issue closes at 05:45 UTC on its day (05:50 at the latest after late bids). The 30-second clock settles each issue once its spots have closed: winners' points are spent, free ones first, and a receipt number issued.
5. **Go-live.** At 06:00 UTC the publish clock puts the issue live: winning ads that are ready go public and readers play them from 10-minute signed R2 links; a winner whose ad isn't ready gets every point back and the spot stays empty. Views, plays and clicks fill the advertiser's report.

## Tests

```sh
npm test            # the real migration in PGlite, plus Bought's own tests
npm run typecheck
```

`tests/e2e/` drives the whole journey in a real browser. `fake-services.mjs` stands in for Supabase and Upstash at their real URLs, with the real migration in PGlite, so everything in `lib/server` runs unchanged. Cloudflare R2 is real: the journeys upload to the bucket in `backend/.env` (which needs CORS for `http://localhost:8010`), the server checks the files with ffprobe, the reader plays from a signed link, and each journey deletes what it uploaded. Nothing here has been run against a real Supabase account.

```sh
BOUGHT_E2E_DIR=/tmp/ads tests/e2e/run-server.sh
PLAYWRIGHT_CORE=/path/to/playwright-core node tests/e2e/journey.cjs /tmp/ads        # needs upload.mp4 (H.264 + AAC) in that folder
PLAYWRIGHT_CORE=/path/to/playwright-core node tests/e2e/journey-more.cjs /tmp/ads   # also silent.mp4: the same video with no sound
```
