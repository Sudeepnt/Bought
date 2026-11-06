# The backend

This is Bought's code with every page removed (the one exception is `public/auth/done.html`, where Google's sign-in window lands and closes): Mux video, Supabase sign-in and database, Stripe and Razorpay payments, Upstash rate limits, and the browser's recording and upload logic. It has no interface of its own. The newspaper's Advertise page in `public/` calls it from its existing buttons.

`pipeline serve` starts it and forwards `/api/bought/*` to it, so the site, `/admin` and this API share one address. Until every core key in `.env` is set, `/api/bought/config` answers `live: false` and the Advertise page keeps its local simulation.

## What came from Bought

| Bought | Here |
| --- | --- |
| `lib/server/providers.ts`, `security.ts`, `config.ts`, `webhooks.ts` | Same files, adapted from one paid broadcast to one ad paid in points |
| `lib/recording-capabilities.ts`, `local-recording.ts`, `recording-retention.ts`, `webhook-signatures.ts` | Same files. Limits follow the Advertise page: 500 MB, 10 minutes uploaded, 60 seconds run |
| The recorder's sound check, wake lock, UpChunk upload (no face detection) | `client/index.ts`, with no UI. Built into `public/js/live/` by `npm run build:client` |
| `bought_drops` and its SQL functions | `bought_ads` and `bought_ad_*` in `supabase/migrations/`, plus the per-spot auction and wallet |

Left behind: all pages, components and CSS, the daily ladder and categories, screen recording (the page has no button for it), web push (it has no permission prompt), the caption and transcript jobs, human review, and face detection.

## Connect it

1. Create a Supabase project and apply `supabase/migrations`. Turn on email sign-in with `{{ .Token }}` in the email template, so readers get a code rather than a link, and set up production SMTP in Supabase Auth.
2. Create a Mux environment: an API token with Video access, a webhook secret and an RSA signing key.
3. Create an Upstash Redis database. Writes are refused when the limiter is unavailable.
4. Copy the values into `backend/.env` (see `.env.example`), set `APP_ORIGIN` to the exact address readers use, and set `CRON_SECRET` to a long random string. Restart `pipeline serve`. `/admin/ads` lists whatever is still missing, by name.
5. Google sign-in (the "Continue with Google" button in the bid sheet): in Google Cloud, create an OAuth client (Web application) whose redirect URI is `https://<your-project>.supabase.co/auth/v1/callback`; in Supabase, Authentication > Providers > Google, paste its client ID and secret; in Authentication > URL Configuration, add `https://<your site>/auth/done.html` to the Redirect URLs. Self-hosted Supabase takes the same three values as `GOTRUE_EXTERNAL_GOOGLE_*` settings.
6. For buying points ($1 each, plus 18% GST in India): Stripe for card (USD), Razorpay for UPI (INR, at the `USD_INR_RATE` you set). Razorpay must use automatic capture.

Webhooks, on the public HTTPS address:

| Provider | Endpoint | Events |
| --- | --- | --- |
| Mux | `/api/bought/webhooks/mux` | `video.upload.asset_created`, `video.upload.errored`, `video.asset.ready`, `video.asset.errored` |
| Stripe | `/api/bought/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` |
| Razorpay | `/api/bought/webhooks/razorpay` | `payment.captured`, `refund.processed` |

## How an ad moves

1. **Sign in.** Google or an emailed code. The first account an email opens gets 100 free points (`bought_ad_open_account`), once.
2. **Bid.** `bought_ad_bid` enforces every rule on the page under a per-spot lock: open and close times, the 1-point reserve, 1-point steps, auto-raise, soft close, points. Bids go in before the upload, so a slow connection can't cost anyone the auction.
3. **Upload.** The video goes straight from the browser to Mux in resumable chunks and never passes through this server. A copy stays on the device until it lands, and a refresh carries on by itself. A still from the video becomes the poster. When Mux has it, the ad is `ready`; a file Mux can't use comes back as `rejected` with the reason. Nobody reviews ads.
4. **Close.** Bidding for an issue closes at 05:45 UTC on its day (05:50 at the latest after late bids). The 30-second clock settles each issue once its spots have closed: winners' points are spent, free ones first, and a receipt number issued.
5. **Go-live.** At 06:00 UTC the publish clock puts the issue live: winning ads that are ready go public and readers play them from signed Mux links; a winner whose ad isn't ready gets every point back and the spot stays empty. Views, plays and clicks fill the advertiser's report.

## Tests

```sh
npm test            # the real migration in PGlite, plus Bought's own tests
npm run typecheck
```

`tests/e2e/` drives the whole journey in a real browser. `fake-services.mjs` stands in for Supabase, Mux and Upstash at their real URLs, with the real migration in PGlite, so everything in `lib/server` runs unchanged. It proves the wiring, not the providers: nothing here has been run against a real Mux or Supabase account.

```sh
BOUGHT_E2E_DIR=/tmp/ads tests/e2e/run-server.sh
PLAYWRIGHT_CORE=/path/to/playwright-core node tests/e2e/journey.cjs /tmp/ads   # needs upload.mp4 and hls/ in that folder
```
