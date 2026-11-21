#!/usr/bin/env bash
# Runs on the Recipeak VM as root (gce-create.sh calls it). Installs Node 24, Caddy and the recipe server from GitHub,
# keeps the usage ledger and cover-photo library on the VM's persistent disk, and serves it at https://$RECIPEAK_BACKEND_HOST.
# Secrets are never written here: /etc/recipeak/backend.env is created with blank keys for the owner to fill in
# (set-secrets.sh asks for them without showing them on screen).
set -euo pipefail
: "${RECIPEAK_BACKEND_HOST:?set RECIPEAK_BACKEND_HOST}"
: "${COMMIT_SHA:?set COMMIT_SHA to the reviewed commit}"
[[ "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid COMMIT_SHA" >&2; exit 1; }
[[ "$RECIPEAK_BACKEND_HOST" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]] || { echo "Invalid backend hostname" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
# e2-micro has 1 GB of memory: add 2 GB of swap so busy moments don't run out.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3
if ! node --version 2>/dev/null | grep -q '^v24'; then
  # Configure the signed package repository directly; never execute a downloaded installer as root.
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  chmod 0644 /etc/apt/keyrings/nodesource.gpg
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi
# The reviewed code, read-only to the service.
if [ ! -d /opt/recipeak/.git ]; then
  install -d -m 0755 /opt/recipeak
  git -C /opt/recipeak init
  git -C /opt/recipeak remote add origin https://github.com/Bmajor1997/Recipeak.git
fi
[[ $(git -C /opt/recipeak remote get-url origin) == https://github.com/Bmajor1997/Recipeak.git ]] || { echo "Unexpected repository origin" >&2; exit 1; }
git -C /opt/recipeak -c core.hooksPath=/dev/null fetch --depth 1 origin "$COMMIT_SHA"
[[ $(git -C /opt/recipeak rev-parse FETCH_HEAD) == "$COMMIT_SHA" ]] || exit 1
git -C /opt/recipeak -c core.hooksPath=/dev/null checkout --force --detach "$COMMIT_SHA"
[[ $(git -C /opt/recipeak rev-parse HEAD) == "$COMMIT_SHA" ]] || exit 1
(cd /opt/recipeak && npm ci --ignore-scripts --omit=dev --no-audit --no-fund)
# Private settings: created once with blank secrets; never overwritten.
install -d -m 0700 /etc/recipeak
if [ ! -f /etc/recipeak/backend.env ]; then
  install -m 0600 /opt/recipeak/deploy/backend/backend.env.example /etc/recipeak/backend.env
  # Test phase: cap all AI spending at $20 a month.
  sed -i 's/^MM_AI_MONTHLY_BUDGET_USD=100$/MM_AI_MONTHLY_BUDGET_USD=20/' /etc/recipeak/backend.env
fi
install -m 0644 /opt/recipeak/deploy/backend/recipeak-backend.service /etc/systemd/system/recipeak-backend.service
systemd-analyze verify /etc/systemd/system/recipeak-backend.service
systemctl daemon-reload
# HTTPS in front of the loopback-only backend.
printf '%s {\n    reverse_proxy 127.0.0.1:8787\n}\n' "$RECIPEAK_BACKEND_HOST" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy && systemctl reload caddy
systemctl enable recipeak-backend
if grep -qE '^(OPENAI_API_KEY|REVENUECAT_SECRET_API_KEY|FIREBASE_PROJECT_ID)=$' /etc/recipeak/backend.env; then
  echo "Recipeak is installed. Add the Firebase project ID and the OpenAI and RevenueCat secret keys: sudo bash /opt/recipeak/deploy/backend/set-secrets.sh"
else
  systemctl restart recipeak-backend
  sleep 3
  curl -fsS "http://127.0.0.1:8787/healthz" && echo " backend healthy"
fi
