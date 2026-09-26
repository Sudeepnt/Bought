# BOUGHT paid broadcasts

BOUGHT runs on **React 19 + Vinext + Vite** and deploys to Vercel through Vinext's Nitro adapter. It does not install or run Next.js; Vinext supplies the compatible App Router APIs used by the application. Supabase provides authentication, PostgreSQL, Realtime, and private thumbnail storage. Mux handles direct video uploads, playback, generated captions, and English caption translation. Stripe and Razorpay handle checkout, and Upstash Redis provides distributed write rate limits.

The implementation is configured with **empty service placeholders**. It does not simulate successful payments or unlock a camera in preview mode. `/broadcast` is the broadcast recording journey, and `/review` is the moderator queue. The homepage's older example market content remains explicitly labelled as a preview; those examples are not paid entries.

## Run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

Without credentials, `/broadcast` still shows categories, the bid, payment methods, and a reservation summary. Sign-in, payment, and recording are unavailable. Only public Supabase settings are returned by `/api/bought/config`; all other values stay server-side. Do not prefix secret values with `NEXT_PUBLIC_` or `VITE_`.

## Connect the services

1. Create or select the intended **BOUGHT Supabase project**. Apply every file in `supabase/migrations` in filename order using the Supabase CLI migration workflow. The migrations create the tables, restricted server functions, RLS, private thumbnail bucket, Realtime publication entries, and the optimized public snapshot. They have been executed against an isolated PostgreSQL runtime in the test suite, not against an account database.
2. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Enable email sign-in and configure the email template to display `{{ .Token }}` for the code-entry flow. Set up production SMTP, email rate limits, and the permitted site origin in Supabase Auth.
3. Set the Stripe and/or Razorpay keys and webhook secrets. Providers are individually enabled only when their credentials and the shared services exist. Start with test-mode accounts. All positions and payment checkouts use **USD**; provider accounts must support USD presentment for the intended customers.
4. Set Mux API credentials, a webhook secret, and an RSA signing key. The Mux API token needs Video access plus the `robots:*` scope for non-English caption translation. `MUX_SIGNING_PRIVATE_KEY` accepts Mux's base64-encoded PEM or PKCS8 PEM with escaped newlines. Mux uploads use signed playback policies; unpublished media never gets a public playback ID.
5. Set Upstash Redis REST URL/token. Write rate limits are atomic and fail closed if the limiter is unavailable.
6. Set `APP_ORIGIN` to the exact HTTPS origin and `CRON_SECRET` to a strong random secret. Store production values in the selected deployment platform's runtime environment. The checked-in `.env.example` contains no credentials.
7. Grant a trusted moderator the **server-managed** Auth app metadata flag `bought_moderator: true` through an administrative account. Never use user metadata for this role. Sign in at `/review`, compare the English transcript with the full broadcast, check the thumbnail, and approve or request a retake. There is no automatic content-approval fallback.

### Webhooks

| Provider | Endpoint                        | Subscribe to                                                                                                          |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Stripe   | `/api/bought/webhooks/stripe`   | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` |
| Razorpay | `/api/bought/webhooks/razorpay` | `payment.captured`, `refund.processed`                                                                                |
| Mux      | `/api/bought/webhooks/mux`      | `video.upload.asset_created`, `video.upload.errored`, `video.asset.ready`, `video.asset.errored`, `video.asset.track.ready`, `robots.job.translate_captions.completed`, `robots.job.translate_captions.errored` |

Configure **automatic capture** in Razorpay. Authorized-only payments do not unlock recording. Stripe's success URL and Razorpay's browser callback only return the user to the waiting screen. The webhook's raw-body signature, provider payment reference, amount, and currency must all match the saved broadcast. Stripe and Mux signatures have a five-minute timestamp tolerance. Razorpay uses an HMAC of the raw body and durable event deduplication. Payment database/linking failures return a retryable response.

## State and recovery

- A `dropId` owns the broadcast's category, integer USD bid, payment, current Mux upload/asset, thumbnail, moderation result, auction, and exposure period.
- Authenticated clients have read-only access to their own broadcasts. Only the server service role can mutate a payment, submit media, rank entries, or approve publication. Public listings contain no user IDs or payment references.
- Public market timing and leaderboard rows are delivered together through one short-lived CDN-cached snapshot. Polling pauses in hidden or offline tabs, and Supabase Realtime requests a fresh snapshot when the ladder changes.
- Camera/microphone permissions are requested only after a fresh authenticated server read confirms `payment_state = paid`. MediaPipe detects one face locally; it is a recording aid, not trusted proof of identity or a server moderation result.
- The recorder produces up to two minutes of broadcast media with microphone audio, supports retakes and playback, and captures a JPEG frame. Recording continues when the user switches tabs or apps, but the BOUGHT page must remain open. Users without a camera can record on a phone or another device and import an MP4, MOV, or WebM take (up to 250 MB); screen broadcasts can be imported the same way. Imported media follows the same Mux audio, duration, resolution, and moderator checks. Users can replace the frame with a custom JPEG/PNG/WebP. Browser decoding/re-encoding and server file-signature checks protect the thumbnail flow.
- Broadcast media bytes travel from the browser straight to Mux using a two-hour resumable upload URL and UpChunk. They never pass through a Worker. New BOUGHT broadcasts use Mux Basic quality, signed playback, and a 1080p encoding cap; Mux automatically serves an adaptive 720p or 1080p stream to each viewer. Thumbnails go directly to private Supabase Storage through a signed upload token, with an immutable, broadcast-specific path and a 5 MB limit. Basic supports on-demand video only.
- Mux generates a caption track for each take and reports when it is ready. If its detected language is not English, Mux Robots translates that caption track into English and attaches the translated WebVTT track to the asset. The app stores the resulting English transcript and captions for moderator review; published playback includes English captions by default.
- Transcription claims are asset-bound, leased, and idempotent. Duplicate Mux deliveries cannot create concurrent work, an older take cannot overwrite a replacement, and moderators can retry a failed rendition or API call. Publication is blocked until the current take has a completed transcript; a human must still verify names, quotations, and meaning against the video.
- A device-local IndexedDB copy keeps the recording, thumbnail, and associated upload attempt through refreshes. It is not payment or publication authority. If storage is unavailable, the UI offers a downloadable backup. Another device can reopen the paid broadcast and record a new take; it cannot recover unuploaded bytes from the first device.
- Failed thumbnail uploads reuse one staging object. On submission, the server validates its bytes and copies them to a new immutable object before moderation, so a still-valid staging token cannot replace an approved image. A replaced Mux upload cannot overwrite the latest take. Processing must find valid broadcast media, an audio track, and an acceptable duration/resolution. Then a moderator checks face visibility, audible speech, content, and the thumbnail before publication.
- Per-user action limits and per-broadcast upload/thumbnail retry budgets bound provider and storage costs. A paid broadcast that exhausts the generous retry budget remains saved for support review instead of creating unbounded provider resources.
- Completed publication clears the local recovery copy. A rejected broadcast keeps the payment and allows a new recording.
- Refunds/disputes remove the public entry. A delayed capture webhook cannot reactivate a reversed payment. Signed playback URLs expire within ten minutes (or the exposure end, if earlier).

### Auction policy

Bidding runs **00:00–12:00 UTC**. Published bids can move during that window. At **12:00 UTC**, the current order is frozen for the exposure period, ending at **00:00 UTC**. Higher paid bids rank first; ties use the earliest server payment confirmation, then `dropId`. A payment reserves an entry, not a guaranteed rank.

A broadcast whose upload or review finishes after the cutoff is assigned to the next auction without a second payment. It remains accessible in the owner's saved broadcasts until that auction becomes public. Per-auction SQL advisory locks serialize ranking mutations without blocking an unrelated auction. The database clock decides all transitions; browser clocks only display a periodically synchronized countdown.

`vercel.json` registers a daily maintenance request to `/api/bought/cron`. Set `CRON_SECRET` in Vercel; Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>`. The endpoint also accepts authenticated POST requests for controlled operational recovery. Ordinary market reads perform the same idempotent database transition, so the auction does not rely on cron timing: a delayed invocation cannot reopen a closed auction or change frozen ranks. This daily schedule is compatible with Vercel Hobby; higher-frequency schedules can be used on plans that support them without changing correctness.

### Checkout reconciliation

The database claims a checkout with a short provider-call lease before contacting the provider, so simultaneous retries cannot both create payable orders. Retrying Stripe uses the same `dropId` idempotency key. After an ambiguous attempt's lease expires, retrying Razorpay first searches for the unique `dropId` receipt and reuses the exact matching order before attempting creation. The database is marked `ready` only after the returned provider reference, amount, currency, and ownership metadata match the saved broadcast. Conflicting or duplicate provider data fails closed and requires operator review; the server never silently creates a replacement. Expired checkout sessions likewise require provider reconciliation before issuing a replacement. This is distinct from upload retries, which need no operator and never charge again.

## Validation and launch status

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The automated suite covers raw webhook signatures, tampering/replay, amount/currency mismatches, RLS/privileged function access, payment and submission idempotency, media-event ordering, transcription leases and asset binding, WebVTT generation, publication gates, server ranking, noon/midnight transitions, rollover, payment reversal, and production secret/configuration validation. PostgreSQL runs locally via PGlite; the test clock override exists only in the test harness.

Before enabling live payments, exercise the full provider test-mode journey over HTTPS with real camera/microphone permissions, failed/retried uploads, webhook retries, and a moderator. Live provider calls and browser camera recording have not been tested using the configuration placeholders.

Run `npm run preflight:production` with the intended Vercel production environment before releasing. It reports missing or structurally unsafe configuration by variable name without printing secret values.

Vercel is the only configured hosting target. The repository includes its security headers, cache policy, serverless build preset, and cron declaration. A Vercel Production build runs `preflight:production` and fails closed if credentials are missing, malformed, reused, exposed to the browser, or use payment test mode; Preview and local builds remain usable without live credentials. Production provider webhooks, Supabase migrations, and a complete test-mode checkout/record/upload/moderation exercise are still required before accepting live payments.

## Reference contracts

- [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Stripe webhook verification](https://docs.stripe.com/webhooks)
- [Razorpay payment events](https://razorpay.com/docs/webhooks/payments/)
- [Mux direct uploads](https://www.mux.com/docs/guides/upload-files-directly) and [signature verification](https://www.mux.com/docs/core/verify-webhook-signatures)
- [Mux static audio renditions](https://www.mux.com/docs/guides/enable-static-mp4-renditions)
- [OpenAI audio translations](https://developers.openai.com/api/reference/python/resources/audio/subresources/translations/methods/create)
- [MediaPipe face detection](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
