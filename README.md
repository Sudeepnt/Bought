# BOUGHT paid broadcasts

BOUGHT stays on **React + Vinext + Cloudflare Workers/Sites**. There is no Vercel deployment path. Existing Inter, Barlow Condensed, JetBrains Mono, and custom CSS are retained.

The implementation is configured with **empty service placeholders**. It does not simulate successful payments or unlock a camera in preview mode. `/drop` is the broadcast recording journey, `/ladder` is the real global ladder, and `/review` is the moderator queue. The homepage's older example market content remains explicitly labelled as a preview; those examples are not paid entries.

## Run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

Without credentials, `/drop` still shows categories, the bid, payment methods, and a reservation summary. Sign-in, payment, and recording are unavailable. Only public Supabase settings are returned by `/api/bought/config`; all other values stay server-side. Do not prefix secret values with `NEXT_PUBLIC_` or `VITE_`.

## Connect the services

1. Create or select the intended **BOUGHT Supabase project**. Apply `supabase/migrations/20260908024518_paid_drop_pipeline.sql` using the Supabase CLI migration workflow or the SQL editor. The migration creates the tables, restricted server functions, RLS, private thumbnail bucket, and Realtime publication entries. It has been executed against an isolated PostgreSQL runtime in the test suite, not against an account database.
2. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Enable email sign-in and configure the email template to display `{{ .Token }}` for the code-entry flow. Set up production SMTP, email rate limits, and the permitted site origin in Supabase Auth.
3. Set the Stripe and/or Razorpay keys and webhook secrets. Providers are individually enabled only when their credentials and the shared services exist. Start with test-mode accounts. All positions and payment checkouts use **USD**; provider accounts must support USD presentment for the intended customers.
4. Set Mux API credentials, a webhook secret, and an RSA signing key. `MUX_SIGNING_PRIVATE_KEY` accepts Mux's base64-encoded PEM or PKCS8 PEM with escaped newlines. Mux uploads use signed playback policies; unpublished media never gets a public playback ID.
5. Set Upstash Redis REST URL/token. Write rate limits are atomic and fail closed if the limiter is unavailable.
6. Set `APP_ORIGIN` to the exact HTTPS origin and `CRON_SECRET` to a strong random secret. Store production values in the existing Cloudflare/Sites runtime environment. The checked-in `.env.example` contains no credentials.
7. Grant a trusted moderator the **server-managed** Auth app metadata flag `bought_moderator: true` through an administrative account. Never use user metadata for this role. Sign in at `/review`, watch the full broadcast, check the thumbnail, and approve or request a retake. There is no automatic content-approval fallback.

### Webhooks

| Provider | Endpoint                        | Subscribe to                                                                                                          |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Stripe   | `/api/bought/webhooks/stripe`   | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created` |
| Razorpay | `/api/bought/webhooks/razorpay` | `payment.captured`, `refund.processed`                                                                                |
| Mux      | `/api/bought/webhooks/mux`      | `video.upload.asset_created`, `video.upload.errored`, `video.asset.ready`, `video.asset.errored`                      |

Configure **automatic capture** in Razorpay. Authorized-only payments do not unlock recording. Stripe's success URL and Razorpay's browser callback only return the user to the waiting screen. The webhook's raw-body signature, provider payment reference, amount, and currency must all match the saved broadcast. Stripe and Mux signatures have a five-minute timestamp tolerance. Razorpay uses an HMAC of the raw body and durable event deduplication. Payment database/linking failures return a retryable response.

## State and recovery

- A `dropId` owns the broadcast's category, integer USD bid, payment, current Mux upload/asset, thumbnail, moderation result, auction, and exposure period.
- Authenticated clients have read-only access to their own broadcasts. Only the server service role can mutate a payment, submit media, rank entries, or approve publication. The public ladder contains no user IDs or payment references.
- Camera/microphone permissions are requested only after a fresh authenticated server read confirms `payment_state = paid`. MediaPipe detects one face locally; it is a recording aid, not trusted proof of identity or a server moderation result.
- The recorder produces up to two minutes of broadcast media with microphone audio, supports retakes and playback, and captures a JPEG frame. Users can replace the frame with a custom JPEG/PNG/WebP. Browser decoding/re-encoding and server file-signature checks protect the thumbnail flow.
- Broadcast media bytes travel from the browser straight to Mux using its resumable upload URL and UpChunk. They never pass through a Worker. Thumbnails go directly to private Supabase Storage through a signed upload token, with an immutable, broadcast-specific path and a 5 MB limit.
- A device-local IndexedDB copy keeps the recording, thumbnail, and associated upload attempt through refreshes. It is not payment or publication authority. If storage is unavailable, the UI offers a downloadable backup. Another device can reopen the paid broadcast and record a new take; it cannot recover unuploaded bytes from the first device.
- Failed thumbnail uploads can reuse the completed broadcast. A replaced Mux upload cannot overwrite the latest take. Processing must find valid broadcast media, an audio track, and an acceptable duration/resolution. Then a moderator checks face visibility, audible speech, content, and the thumbnail before publication.
- Completed publication clears the local recovery copy. A rejected broadcast keeps the payment and allows a new recording.
- Refunds/disputes remove the public entry. A delayed capture webhook cannot reactivate a reversed payment. Signed playback URLs expire within ten minutes (or the exposure end, if earlier).

### Auction policy

Bidding runs **00:00–12:00 UTC**. Published bids can move during that window. At **12:00 UTC**, the current order is frozen for the exposure period, ending at **00:00 UTC**. Higher paid bids rank first; ties use the earliest server payment confirmation, then `dropId`. A payment reserves an entry, not a guaranteed rank.

A broadcast whose upload or review finishes after the cutoff is assigned to the next auction without a second payment. It remains accessible in the owner's saved broadcasts until that auction becomes public. SQL advisory locks serialize auction/ranking mutations. The database clock decides all transitions; browser clocks only display a periodically synchronized countdown.

`worker.ts` exports both `fetch` and `scheduled`. The Cloudflare build includes an every-minute Cron Trigger. Confirm the trigger is attached by the selected Cloudflare/Sites deployment platform. The scheduled handler invokes the authenticated auction endpoint, and ordinary market reads also perform the same idempotent transition, so a delayed cron cannot reopen a closed auction or change frozen ranks. No Vercel configuration or scheduler is used.

### Checkout reconciliation

The database claims a checkout before contacting the provider. Stripe creation also uses `dropId` as the idempotency key. An ambiguous provider-create failure is deliberately left in `creating`; automatically retrying Razorpay order creation could create a second payable order. An operator must look up the existing provider checkout/order by its `dropId` metadata/receipt, link its reference and URL to the original drop, then set `checkout_state = ready`. Do not reset the claim or create a second order until the provider confirms no order/payment exists. Expired Stripe Checkout sessions likewise require provider reconciliation before issuing a replacement. This is distinct from upload retries, which need no operator and never charge again.

## Validation and launch status

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The automated suite covers raw webhook signatures, tampering/replay, amount/currency mismatches, RLS/privileged function access, payment and submission idempotency, media-event ordering, publication gates, server ranking, noon/midnight transitions, rollover, and payment reversal. PostgreSQL runs locally via PGlite; the test clock override exists only in the test harness.

Before enabling live payments, exercise the full provider test-mode journey over HTTPS with real camera/microphone permissions, failed/retried uploads, webhook retries, and a moderator. Live provider calls and browser camera recording have not been tested using the configuration placeholders.

The repository's saved Sites project was not accessible during this implementation. No replacement site, paid service, database, or public deployment was created. Restore access to that project before publishing. The generated Cloudflare build includes the fetch and scheduled handlers.

## Reference contracts

- [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Stripe webhook verification](https://docs.stripe.com/webhooks)
- [Razorpay payment events](https://razorpay.com/docs/webhooks/payments/)
- [Mux direct uploads](https://www.mux.com/docs/guides/upload-files-directly) and [signature verification](https://www.mux.com/docs/core/verify-webhook-signatures)
- [MediaPipe face detection](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
