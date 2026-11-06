#!/bin/zsh
# sandbox: its own data folder, its own ports; the real issue pages are only read
cd "$(dirname "$0")/../../.."
export BOUGHT_DATA="${BOUGHT_E2E_DIR:?folder for the test data}/data" BOUGHT_ADMIN_PASSWORD=test-pass BOUGHT_BACKEND_PORT=8797 FAKE_CONTROL_PORT=8798
export APP_ORIGIN=http://localhost:8010 SUPABASE_URL=https://fake.supabase.test SUPABASE_PUBLISHABLE_KEY=pub SUPABASE_SERVICE_ROLE_KEY=svc
export MUX_TOKEN_ID=m MUX_TOKEN_SECRET=m MUX_WEBHOOK_SECRET=muxsecret MUX_SIGNING_KEY_ID=k
export UPSTASH_REDIS_REST_URL=https://fake.upstash.test UPSTASH_REDIS_REST_TOKEN=u CRON_SECRET=cronsecret
export RAZORPAY_KEY_ID=rzp_test RAZORPAY_KEY_SECRET=s RAZORPAY_WEBHOOK_SECRET=rzpsecret USD_INR_RATE=85 STRIPE_SECRET_KEY=sk STRIPE_WEBHOOK_SECRET=wh
export MUX_SIGNING_PRIVATE_KEY=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | base64 | tr -d '\n')
export NODE_OPTIONS="--import=file://${PWD// /%20}/backend/tests/e2e/fake-services.mjs"
exec ~/.cache/bought/funnel-venv/bin/python -m pipeline serve --port 8010
