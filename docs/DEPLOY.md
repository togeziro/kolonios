# Deploy — Kolonios

Production target: a single Linux VPS running **Bun** (Nitro `bun` preset),
**systemd**, and **Caddy** (automatic TLS), with **self-hosted PostgreSQL 16**
on the same host and **managed S3** for object storage.

```
internet ──TLS──▶ Caddy :443 ──▶ 127.0.0.1:3000 (Bun/Nitro) ──▶ PostgreSQL 127.0.0.1:5432
                                                              └──▶ S3 (managed)
```

## Files

| Path | Purpose |
| --- | --- |
| `deploy/kolonios.service` | systemd unit for the app |
| `deploy/Caddyfile` | reverse proxy + TLS + security headers |
| `deploy/kolonios.env.example` | production env template |
| `deploy/deploy.sh` | on-host build/migrate/restart/health-check |
| `deploy/backup-postgres.sh` | `pg_dump` + retention |
| `.github/workflows/deploy.yml` | deploy on green CI to `main` |

## Production safety (read first)

- **Never auto-seed production.** `scripts/migrate.ts` seeds demo users with
  the well-known `Password123!` login when the user table is empty. It now
  refuses to seed when `NODE_ENV=production` (override only with
  `ALLOW_PROD_SEED=1`), and every deploy runs with `--no-seed`. Create the
  first admin manually instead.
- **`BETTER_AUTH_SECRET` must be strong and stable** (`openssl rand -hex 32`).
  Rotating it logs everyone out.
- **Back up `STORAGE_ENCRYPTION_KEY`.** Provider credentials saved through the
  admin UI are encrypted with it; losing the key makes them unrecoverable.
- **`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` must be the real HTTPS
  domain**, or sign-in fails with an origin/CSRF error.
- The app **fails fast at boot** in production if `DATABASE_URL`,
  `BETTER_AUTH_URL`, `STORAGE_ENCRYPTION_KEY`, or `BETTER_AUTH_SECRET` is
  missing (`src/lib/env.ts`), instead of silently using the dev database.

## 1. Provision the host (human-only)

Run as a sudo-capable user. These steps need a human; the wizard at
`/wizard` automates the interactive parts.

```bash
# Firewall + updates
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable

# Bun 1.4.0 (must match CI — see .github/actions/setup/action.yml)
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.0"
sudo install -m 755 "$HOME/.bun/bin/bun" /usr/local/bin/bun

# PostgreSQL 16
sudo apt install -y postgresql-16
sudo -u postgres psql -c "CREATE ROLE kolonios LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE kolonios OWNER kolonios;"

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Service user + directories
sudo useradd --system --home /opt/kolonios --shell /usr/sbin/nologin kolonios
sudo mkdir -p /opt/kolonios /etc/kolonios /var/backups/kolonios
sudo git clone <repo-url> /opt/kolonios
sudo chown -R kolonios:kolonios /opt/kolonios
```

## 2. Configure secrets

```bash
sudo cp deploy/kolonios.env.example /etc/kolonios/kolonios.env
sudo chmod 600 /etc/kolonios/kolonios.env
sudo chown root:kolonios /etc/kolonios/kolonios.env
sudo nano /etc/kolonios/kolonios.env   # fill in database + secrets + domain
```

Generate secrets with `openssl rand -hex 32`. Keep a copy of
`STORAGE_ENCRYPTION_KEY` somewhere safe outside the host.

Install the units/config:

```bash
sudo cp deploy/kolonios.service /etc/systemd/system/kolonios.service
sudo systemctl daemon-reload
sudo systemctl enable kolonios
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # set DOMAIN, see below
sudo systemctl reload caddy
```

The Caddyfile reads `{$DOMAIN}`. Provide it via `/etc/default/caddy`
(`DOMAIN=app.example.com`) or edit the Caddyfile directly. Point DNS at the
host and Caddy will issue the certificate automatically.

Allow the service user to restart the app without a password (used by
`deploy.sh`):

```bash
echo 'kolonios ALL=(root) NOPASSWD: /usr/bin/systemctl restart kolonios' \
  | sudo tee /etc/sudoers.d/kolonios-restart
sudo chmod 440 /etc/sudoers.d/kolonios-restart
```

## 3. First deploy

```bash
cd /opt/kolonios
sudo -u kolonios APP_DIR=/opt/kolonios bash deploy/deploy.sh
```

Then verify and create the first admin account (never rely on the seed):

```bash
curl -fsS https://app.example.com/api/v1/health
```

- Visit `/auth/v2/sign-in` and create/seed the first admin via the app's
  admin flow, or insert one through the UI after a controlled one-off
  `ALLOW_PROD_SEED=1` run on a **staging** database — not production.
- Log in, then confirm S3 uploads work from Admin → Storage Settings.

## 4. Continuous deployment

`.github/workflows/deploy.yml` deploys whenever the **CI** workflow completes
successfully on `main`. Add these repository secrets (Settings → Secrets →
Actions) and a `production` environment:

| Secret | Example |
| --- | --- |
| `DEPLOY_HOST` | `203.0.113.10` |
| `DEPLOY_USER` | `kolonios` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_SSH_KEY` | private key of a deploy keypair (add the public key to `/home/kolonios/.ssh/authorized_keys`) |
| `DEPLOY_PATH` | `/opt/kolonios` |

The workflow SSHes in, fetches the CI-green commit, checks it out, and runs
`deploy/deploy.sh` (install → build → migrate `--no-seed` → restart → health
check).

## 5. Backups

```bash
sudo crontab -e
# daily at 03:00
0 3 * * * ENV_FILE=/etc/kolonios/kolonios.env /opt/kolonios/deploy/backup-postgres.sh
```

Restore:

```bash
gunzip -c /var/backups/kolonios/kolonios-<stamp>.sql.gz | psql "$DATABASE_URL"
```

Test restores periodically — an untested backup is not a backup.

## 6. Rollback

```bash
cd /opt/kolonios
git checkout --force <previous-good-sha>
APP_DIR=/opt/kolonios bash deploy/deploy.sh
```

Migrations are **forward-only** (Drizzle). If a release includes a destructive
migration, restore the database backup taken before deploy rather than
checking out old code against a new schema.

## 7. Manual / local production dry-run

```bash
cp .env.example .env   # set DATABASE_URL + secrets
bun run build
NODE_ENV=production bun run start
curl -fsS http://127.0.0.1:3000/api/v1/health
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Boot fails with "Missing required environment variables" | `/etc/kolonios/kolonios.env` incomplete; check `journalctl -u kolonios` |
| Sign-in fails with origin/CSRF error | `BETTER_AUTH_URL`/`BETTER_AUTH_TRUSTED_ORIGINS` not the public HTTPS domain |
| Health returns 503 | Postgres down or `DATABASE_URL` wrong |
| Migration exits on drift | Database was managed with `db:push`; reconcile with `bun run db:baseline` |
| Demo users appear | A migration ran without `--no-seed`; rotate those passwords immediately |
