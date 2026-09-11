#!/usr/bin/env bash
#
# Dumps the production database to a gzipped SQL file and prunes old backups.
# Run from a systemd timer or cron, e.g. daily:
#   0 3 * * * /opt/kolonios/deploy/backup-postgres.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/kolonios/kolonios.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kolonios}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL must be set}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/kolonios-$stamp.sql.gz"

# Dump to a temp file first: a mid-stream pg_dump failure under `pipefail`
# would otherwise leave a truncated .gz that looks like a real backup.
tmp="$(mktemp "$BACKUP_DIR/.kolonios-XXXXXX.sql.gz")"
trap 'rm -f "$tmp"' EXIT
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 >"$tmp"
gzip -t "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$file"
trap - EXIT
echo "Wrote $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -type f -name 'kolonios-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
