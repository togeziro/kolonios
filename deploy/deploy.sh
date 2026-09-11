#!/usr/bin/env bash
#
# Runs ON the production host after the repo has been checked out to the
# target revision. Installs deps, builds, migrates (never seeds demo data),
# restarts the service, and verifies the health endpoint.
#
# Usage: APP_DIR=/opt/kolonios bash deploy/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kolonios}"
ENV_FILE="${ENV_FILE:-/etc/kolonios/kolonios.env}"
SERVICE="${SERVICE:-kolonios}"

cd "$APP_DIR"
export PATH="/usr/local/bin:$HOME/.bun/bin:$PATH"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "ERROR: cannot read $ENV_FILE as $(id -un)." >&2
  echo "       Install it mode 640, owned root:kolonios (see docs/DEPLOY.md)." >&2
  exit 1
fi

# Load runtime + build-time config. VITE_* values are baked into the client
# bundle here, so they must be present at build time.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "==> Installing dependencies (frozen lockfile)"
bun install --frozen-lockfile

echo "==> Building"
bun run build

echo "==> Applying migrations (no demo seed)"
bun run scripts/migrate.ts --no-seed

echo "==> Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

echo "==> Waiting for health"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT:-3000}/api/v1/health" >/dev/null 2>&1; then
    echo "OK: app is healthy"
    exit 0
  fi
  sleep 2
done

echo "ERROR: health check did not pass" >&2
sudo systemctl status "$SERVICE" --no-pager >&2 || true
exit 1
