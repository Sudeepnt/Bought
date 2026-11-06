#!/usr/bin/env bash
# Sets up (or updates) Bought on a fresh Ubuntu 24.04 VPS. Run as root from the checkout at /srv/bought:
#
#   BOUGHT_DOMAIN=bought.example ./deploy/setup.sh
#
# Safe to run again: it updates packages, dependencies and services and restarts them.
# It never touches /etc/bought/bought.env once it exists (keys live there), nor pipeline/data (the databases).
set -euo pipefail

ROOT=/srv/bought
MODELS=$ROOT/models
DOMAIN=${BOUGHT_DOMAIN:?set BOUGHT_DOMAIN to the site address, e.g. bought.example}
cd "$ROOT"
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }

say() { printf '\n== %s\n' "$*"; }

say "system packages"
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-dev ffmpeg git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https brotli sqlite3 >/dev/null
if ! command -v node >/dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

say "service user"
id bought >/dev/null 2>&1 || useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin bought
mkdir -p "$MODELS" "$ROOT/backups" "$ROOT/pipeline/data" "$ROOT/pipeline/out" "$ROOT/public/issues" /etc/bought /var/log/caddy
chown -R bought:bought "$ROOT"
chown caddy:caddy /var/log/caddy

as_bought() { sudo -u bought -H env BOUGHT_HOME="$MODELS" PLAYWRIGHT_BROWSERS_PATH="$MODELS/ms-playwright" "$@"; }

say "python: site, admin, funnel"
[ -x .venv/bin/python ] || as_bought python3 -m venv .venv
as_bought .venv/bin/pip install -q --upgrade pip
as_bought .venv/bin/pip install -q -r pipeline/requirements.lock

say "python: voice and translation models' runtime"
[ -x "$MODELS/tts/venv/bin/python" ] || as_bought python3 -m venv "$MODELS/tts/venv"
as_bought "$MODELS/tts/venv/bin/pip" install -q --upgrade pip
as_bought "$MODELS/tts/venv/bin/pip" install -q -r pipeline/requirements-models.lock

say "node: video renderer, ads backend, Chromium"
as_bought npm ci --no-audit --no-fund
as_bought npm --prefix backend ci --no-audit --no-fund
npx --yes playwright-core install-deps chromium >/dev/null
as_bought npx playwright-core install chromium

say "models"
missing=0
for f in tts/kokoro-v1.0.int8.onnx tts/voices-v1.0.bin m2m100_ct2/model.bin; do
  [ -s "$MODELS/$f" ] || { echo "missing: $MODELS/$f"; missing=1; }
done
if [ $missing = 1 ]; then
  echo "Copy the models from the laptop that has them, then run this again:"
  echo "  rsync -a ~/.cache/bought/tts/kokoro-v1.0.int8.onnx ~/.cache/bought/tts/voices-v1.0.bin root@$DOMAIN:$MODELS/tts/"
  echo "  rsync -a ~/.cache/bought/m2m100_ct2 root@$DOMAIN:$MODELS/"
  echo "The site runs without them; making videos, audio and translations needs them."
fi

say "precompressed copies of the big static files (Caddy serves .br/.gz when the browser accepts them)"
find public/mediapipe public/js public/fonts public/styles.css -type f \( -name '*.js' -o -name '*.wasm' -o -name '*.css' \) | while read -r f; do
  [ "$f.gz" -nt "$f" ] || gzip -9 -k -f "$f"
  [ "$f.br" -nt "$f" ] || brotli -q 11 -f -o "$f.br" "$f"
done
chown -R bought:bought public

say "settings file"
if [ ! -f /etc/bought/bought.env ]; then
  {
    echo "# Bought's settings and keys. Only root and the service read this file."
    echo "SITE_URL=https://$DOMAIN"
    echo "APP_ORIGIN=https://$DOMAIN"
    echo "BOUGHT_ADMIN_PASSWORD=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
    echo "CRON_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')"
    echo "# Email (pipeline/mailer.py)"
    echo "BOUGHT_SMTP_HOST="
    echo "BOUGHT_SMTP_PORT=587"
    echo "BOUGHT_SMTP_USER="
    echo "BOUGHT_SMTP_PASS="
    echo "BOUGHT_SMTP_FROM="
    echo "# Ads: fill these from backend/.env.example (Supabase, Mux, Upstash, Stripe, Razorpay)."
    grep -E '^[A-Z_]+=' backend/.env.example | grep -vE '^(APP_ORIGIN|CRON_SECRET)=' | sed 's/=.*/=/'
  } > /etc/bought/bought.env
  echo "wrote /etc/bought/bought.env: the admin password is in it"
fi
chown root:bought /etc/bought/bought.env
chmod 640 /etc/bought/bought.env

say "services"
install -m 644 deploy/bought.service deploy/bought-backup.service deploy/bought-backup.timer /etc/systemd/system/
install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=BOUGHT_DOMAIN=%s\nEnvironment=BOUGHT_ROOT=%s\n' "$DOMAIN" "$ROOT" > /etc/systemd/system/caddy.service.d/bought.conf
systemctl daemon-reload
systemctl enable --now bought.service bought-backup.timer caddy >/dev/null
systemctl restart bought.service
systemctl reload-or-restart caddy

say "check"
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:8000/healthz >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:8000/healthz && echo
echo "Site: https://$DOMAIN/   Admin: https://$DOMAIN/admin   Logs: journalctl -u bought -f"
