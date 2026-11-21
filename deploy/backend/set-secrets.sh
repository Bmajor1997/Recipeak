#!/usr/bin/env bash
# Runs on the Recipeak VM as root. Asks for the backend's secret keys without showing them on screen,
# saves them to /etc/recipeak/backend.env (mode 0600), restarts the backend and checks it's healthy.
# Press Enter at a prompt to keep the value already saved.
set -euo pipefail
FILE=/etc/recipeak/backend.env
[ -f "$FILE" ] || { echo "Run vm-bootstrap.sh first."; exit 1; }
set_key() {
  local name="$1" prompt="$2" value
  read -r -s -p "$prompt (input is hidden, Enter to keep current): " value </dev/tty; echo
  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  [ -z "$value" ] && return 0
  local tmp; tmp="$(mktemp)"
  grep -v "^$name=" "$FILE" > "$tmp" || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  install -m 0600 "$tmp" "$FILE"; rm -f "$tmp"
  echo "  Saved $name."
}
set_key FIREBASE_PROJECT_ID "Type the Firebase project ID"
set_key REVENUECAT_SECRET_API_KEY "Paste the RevenueCat secret API key"
set_key OPENAI_API_KEY "Paste the OpenAI API key"
systemctl restart recipeak-backend
sleep 4
if curl -fsS http://127.0.0.1:8787/healthz >/dev/null; then
  echo "Recipeak server is running."
else
  echo "Recipeak server did not start. Last log lines (no secret values are logged):"
  journalctl -u recipeak-backend -n 20 --no-pager
fi
