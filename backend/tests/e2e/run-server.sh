#!/bin/zsh
# sandbox: its own data folder, its own ports; the real issue pages are only read.
# Supabase and Upstash are stand-ins (fake-services.mjs); ad videos go to the REAL R2 bucket in backend/.env,
# under ads/<random ad id>/, and the journey deletes what it made. The keys are read from the file, never printed.
cd "$(dirname "$0")/../../.."
for k in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  v=$(grep -E "^$k=" backend/.env 2>/dev/null | head -1 | cut -d= -f2-)
  [ -n "$v" ] || { echo "backend/.env needs $k for the R2 journey" >&2; exit 1; }
  export "$k=$v"
done
export BOUGHT_ADMIN_TOTP=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP BOUGHT_DESK_PORT=8011
export BOUGHT_DATA="${BOUGHT_E2E_DIR:?folder for the test data}/data" BOUGHT_ADMIN_PASSWORD=test-pass BOUGHT_BACKEND_PORT=8797 FAKE_CONTROL_PORT=8798
export APP_ORIGIN=http://localhost:8010 SUPABASE_URL=https://fake.supabase.test SUPABASE_PUBLISHABLE_KEY=pub SUPABASE_SERVICE_ROLE_KEY=svc
export UPSTASH_REDIS_REST_URL=https://fake.upstash.test UPSTASH_REDIS_REST_TOKEN=u CRON_SECRET=cronsecret
export RAZORPAY_KEY_ID=rzp_test RAZORPAY_KEY_SECRET=s RAZORPAY_WEBHOOK_SECRET=rzpsecret USD_INR_RATE=85 STRIPE_SECRET_KEY=sk_test_e2e   # no STRIPE_WEBHOOK_SECRET: card payments must work without one
export NODE_OPTIONS="--import=file://${PWD// /%20}/backend/tests/e2e/fake-services.mjs"
exec ~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8010 --desk-port 8011
