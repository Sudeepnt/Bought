# The backend

This is Bought's code with every page removed: Mux video, Supabase sign-in and database, Stripe and Razorpay payments, Upstash rate limits, and the browser's recording and upload logic. It has no interface of its own. The newspaper's Advertise page in `public/` calls it from its existing buttons.

`pipeline serve` starts it and forwards `/api/bought/*` to it, so the site, `/admin` and this API share one address. Until every core key in `.env` is set, `/api/bought/config` answers `live: false` and the Advertise page keeps its local simulation.

## What came from Bought

| Bought | Here |
| --- | --- |
| `lib/server/providers.ts`, `security.ts`, `config.ts`, `webhooks.ts`, `transcription.ts` | Same files, adapted from one paid broadcast to one ad plus prepaid credits |
| `lib/recording-capabilities.ts`, `local-recording.ts`, `recording-retention.ts`, `webhook-signatures.ts` | Same files. Limits follow the Advertise page: 500 MB, 10 minutes uploaded, 60 seconds run |
| The recorder's face guide, sound check, wake lock, UpChunk upload | `client/index.ts`, with no UI. Built into `public/js/live/` by `npm run build:client` |
| `/review` moderator page | `/admin/ads`, behind the admin password |
| `bought_drops` and its SQL functions | `bought_ads` and `bought_ad_*` in `supabase/migrations/`, plus the per-spot auction and wallet |

Left behind: all pages, components and CSS, the daily ladder and categories, screen recording (the page has no button for it), web push (it has no permission prompt), and the ten-language caption job (the reviewer needs only English).

## Connect it

1. Create a Supabase project and apply `supabase/migrations`. Turn on email sign-in with `{{ .Token }}` in the email template, so readers get a code rather than a link, and set up production SMTP in Supabase Auth.
2. Create a Mux environment: an API token with Video access plus `robots:*`, a webhook secret and an RSA signing key.
3. Create an Upstash Redis database. Writes are refused when the limiter is unavailable.
4. Copy the values into `backend/.env` (see `.env.example`), set `APP_ORIGIN` to the exact address readers use, and set `CRON_SECRET` to a long random string. Restart `pipeline serve`. `/admin/ads` lists whatever is still missing, by name.
5. For adding credits: Stripe for card (USD), Razorpay for UPI (INR, at the `USD_INR_RATE` you set). Razorpay must use automatic capture.

Webhooks, on the public HTTPS address:

| Provider | Endpoint | Events |
| --- | --- | --- |
| Mux | `/api/bought/webhooks/mux` | `video.upload.asset_created`, `video.upload.errored`, `video.asset.ready`, `video.asset.errored`, `video.asset.track.ready`, `robots.job.translate_captions.completed`, `robots.job.translate_captions.errored` |
| Stripe | `/api/bought/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` |
| Razorpay | `/api/bought/webhooks/razorpay` | `payment.captured`, `refund.processed` |

## How an ad moves

1. **Bid.** `bought_ad_bid` enforces every rule on the page under a per-spot lock: open and close times, reserve, increment, auto-raise, soft close, credits. Bids go in before the upload, so a slow connection can't cost anyone the auction.
2. **Upload.** The video goes straight from the browser to Mux in resumable chunks and never passes through this server. A copy stays on the device until it lands, and a refresh carries on by itself. A still from the video becomes the poster.
3. **Review.** Mux reports the video ready and sends captions. A person reads the transcript and approves in `/admin/ads`, or sends the ad back with a reason.
4. **Close.** The 30-second clock settles each issue once its spots have closed: winners' credits are deducted and an invoice number issued.
5. **05:00 IST.** A winner whose ad still isn't approved is refunded, and the next bidder with an approved ad and enough credits takes the spot.
6. **Go-live.** When the publish clock puts the issue live, its winning ads go public and readers play them from signed Mux links. Views, plays and clicks fill the advertiser's report.

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
