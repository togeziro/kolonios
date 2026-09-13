#!/usr/bin/env bash
#
# Reverts the app to a previous revision and redeploys it.
#
# Usage: APP_DIR=/opt/kolonios bash deploy/rollback.sh [<sha>]
#   <sha> defaults to the pre-deploy revision recorded by deploy.sh.
#
# NOTE: code rolls back, data does not. Destructive migrations are forward-only
# (Drizzle has no down-migrations); if the bad release already migrated, restore
# the VM snapshot instead of — or before — running this.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kolonios}"
STATE_DIR="${STATE_DIR:-/var/backups/kolonios}"

SHA="${1:-}"
if [[ -z "$SHA" ]]; then
  state_file="$STATE_DIR/pre-deploy-sha"
  if [[ -r "$state_file" ]]; then
    SHA="$(cat "$state_file")"
  fi
fi
if [[ -z "$SHA" ]]; then
  echo "ERROR: no SHA given and $STATE_DIR/pre-deploy-sha is missing or empty." >&2
  echo "       Usage: APP_DIR=$APP_DIR bash deploy/rollback.sh <previous-good-sha>" >&2
  exit 1
fi

cd "$APP_DIR"
echo "==> Rolling back to $SHA"
git checkout --force "$SHA"
APP_DIR="$APP_DIR" STATE_DIR="$STATE_DIR" bash deploy/deploy.sh
