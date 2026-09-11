# Deploy — Kolonios

Production target: a single Linux VM running **Bun** (Nitro `bun` preset),
**systemd**, and **Caddy**, with **self-hosted PostgreSQL** on the same host
and **managed S3** for object storage.

```
internet / LAN ──TLS──▶ Caddy :443 ──▶ 127.0.0.1:3000 (Bun/Nitro) ──▶ PostgreSQL 127.0.0.1:5432
                                                                    └──▶ S3 (managed)
```

> **Fast path:** run `bash scripts/prod-setup.sh` from the repo root. The wizard
> walks the human-only steps below, generates secrets, writes
> `deploy/kolonios.prod.env`, and sets the CI deploy secrets. The manual
> runbook below is the reference it follows.

## Files

| Path | Purpose |
| --- | --- |
| `scripts/prod-setup.sh` | guided first-time provisioning wizard |
| `deploy/kolonios.service` | systemd unit for the app |
| `deploy/Caddyfile` | reverse proxy + automatic TLS (public domain) |
| `deploy/Caddyfile.internal` | reverse proxy + self-signed TLS (internal VM) |
| `deploy/kolonios.env.example` | production env template |
| `deploy/deploy.sh` | on-host install/build/migrate/restart/health-check |
| `deploy/backup-postgres.sh` | `pg_dump` + retention |
| `.github/workflows/deploy.yml` | deploy on green CI to `main` |

## Production safety (read first)

- **Never auto-seed production.** `scripts/migrate.ts` seeds demo users with
  the well-known `Password123!` login when the user table is empty. It refuses
  to seed when `NODE_ENV=production` (override only with `ALLOW_PROD_SEED=1`),
  and every deploy runs with `--no-seed`. Create the first admin manually
  (see §3).
- **`BETTER_AUTH_SECRET` must be strong and stable** (`openssl rand -hex 32`).
  Rotating it logs everyone out.
- **Back up `STORAGE_ENCRYPTION_KEY`.** Provider credentials saved through the
  admin UI are encrypted with it; losing the key makes them unrecoverable.
- **`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` must be the URL users
  actually visit**, or sign-in fails with an origin/CSRF error.
- The app **fails fast at boot** in production if `DATABASE_URL`,
  `BETTER_AUTH_URL`, `STORAGE_ENCRYPTION_KEY`, or `BETTER_AUTH_SECRET` is
  missing (`src/lib/env.ts`), instead of silently using the dev database.

## 1. Provision the host (human-only)

Two identities are involved: **your admin login** (e.g. `root`) for
provisioning, and the **`kolonios` deploy/service account** the app runs as
and CI SSHes in as. The service account needs a login shell for CD, so keep it
key-only (disable password auth).

```bash
# Firewall + updates
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw git curl ca-certificates rsync ssh
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp        # skip if an edge proxy already terminates TLS
sudo ufw --force enable

# Bun 1.4.0 (must match CI — see .github/actions/setup/action.yml)
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.0"
sudo install -m 755 "$HOME/.bun/bin/bun" /usr/local/bin/bun
bun --version                    # expect 1.4.0

# PostgreSQL (distro package; check the version: psql --version)
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE ROLE kolonios LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE kolonios OWNER kolonios;"

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Deploy/service account: login-capable for CD, key-only in practice
sudo useradd --system --home-dir /opt/kolonios --shell /bin/bash kolonios
sudo mkdir -p /opt/kolonios /etc/kolonios /var/backups/kolonios
sudo git clone <repo-url> /opt/kolonios
sudo chown -R kolonios:kolonios /opt/kolonios

# Authorize the deploy public key for SSH (CI + occasional ops)
sudo install -d -m 700 -o kolonios -g kolonios /opt/kolonios/.ssh
echo '<deploy-public-key>' | sudo tee /opt/kolonios/.ssh/authorized_keys
sudo chown kolonios:kolonios /opt/kolonios/.ssh/authorized_keys
sudo chmod 600 /opt/kolonios/.ssh/authorized_keys
```

## 2. Configure secrets

```bash
sudo cp deploy/kolonios.env.example /etc/kolonios/kolonios.env
# 640: root owns it, the kolonios group must read it for deploy.sh
sudo chmod 640 /etc/kolonios/kolonios.env
sudo chown root:kolonios /etc/kolonios/kolonios.env
sudo nano /etc/kolonios/kolonios.env   # fill in database + secrets + URL
```

Generate secrets with `openssl rand -hex 32`. Keep a copy of
`STORAGE_ENCRYPTION_KEY` somewhere safe outside the host.

Install the app unit:

```bash
sudo cp deploy/kolonios.service /etc/systemd/system/kolonios.service
sudo systemctl daemon-reload
sudo systemctl enable kolonios
```

Install the Caddy config. The Caddyfiles read `{$DOMAIN}`, but the packaged
`caddy.service` does **not** load `/etc/default/caddy`, so add a drop-in that
does:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile          # or Caddyfile.internal for a self-signed internal VM
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/default/caddy\n' \
  | sudo tee /etc/systemd/system/caddy.service.d/kolonios-env.conf
echo 'DOMAIN=app.example.com' | sudo tee /etc/default/caddy
sudo systemctl daemon-reload
sudo systemctl restart caddy
```

For the public-domain path, point DNS at the host and Caddy issues the
certificate automatically. For an internal VM, use `Caddyfile.internal`
(`tls internal`); browsers warn until the internal CA is trusted.

Allow the service account to restart the app without a password (used by
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
curl -k https://app.example.com/api/v1/health   # -k for the self-signed internal cert
```

Register the first account at `/auth/v2/sign-in`, then grant it full access
(never rely on the seed):

```bash
set -a; source /etc/kolonios/kolonios.env; set +a
psql "$DATABASE_URL" <<'SQL'
INSERT INTO role_groups (id,name,description,permissions,is_admin)
VALUES ('zzzrg-admin','Administrator','Full system access','{}'::jsonb,true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_role_groups (user_id,role_group_id)
SELECT id,'zzzrg-admin' FROM "user" WHERE email='you@example.com'
ON CONFLICT (user_id) DO NOTHING;
UPDATE "user" SET role='admin' WHERE email='you@example.com';
SQL
```

Log in, then confirm S3 uploads work from Admin → Storage Settings.

## 4. Continuous deployment

`.github/workflows/deploy.yml` deploys whenever the **CI** workflow completes
successfully on `main`. Add these repository secrets (Settings → Secrets →
Actions) and a `production` environment:

| Secret | Example |
| --- | --- |
| `DEPLOY_HOST` | `203.0.113.10` |
| `DEPLOY_USER` | `kolonios` |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_SSH_KEY` | private key of a deploy keypair (public key in `/opt/kolonios/.ssh/authorized_keys`) |
| `DEPLOY_PATH` | `/opt/kolonios` |

The workflow SSHes in as `kolonios`, fetches the CI-green commit, checks it
out, and runs `deploy/deploy.sh` (install → build → migrate `--no-seed` →
restart → health check). Because the work runs as `kolonios`, the repo must be
writable by it (it is, from §1).

## 5. Backups

```bash
sudo crontab -u kolonios -e
# daily at 03:00
0 3 * * * ENV_FILE=/etc/kolonios/kolonios.env /opt/kolonios/deploy/backup-postgres.sh
```

The `kolonios` user can read the 640 env file. Restore:

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
cp .env.example .env   # set DATABASE_URL, BETTER_AUTH_SECRET, STORAGE_ENCRYPTION_KEY
bun run build
NODE_ENV=production bun run start
curl -fsS http://127.0.0.1:3000/api/v1/health
```

The app refuses to start in production if any required variable is missing, so
a successful boot is itself a check of the env.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `cannot read /etc/kolonios/kolonios.env` on deploy | Env is `600`; make it `640 root:kolonios` (§2) |
| Boot fails with "Missing required environment variables" | `/etc/kolonios/kolonios.env` incomplete; check `journalctl -u kolonios` |
| `caddy` reload fails / empty site address | No `EnvironmentFile` drop-in for `{$DOMAIN}` (§2) |
| CD says `Permission denied (publickey)` | Deploy public key not in `/opt/kolonios/.ssh/authorized_keys`, or `DEPLOY_USER` isn't `kolonios` |
| Sign-in fails with origin/CSRF error | `BETTER_AUTH_URL`/`BETTER_AUTH_TRUSTED_ORIGINS` not the URL users visit |
| Health returns 503 | Postgres down or `DATABASE_URL` wrong |
| Migration exits on drift | Database was managed with `db:push`; reconcile with `bun run db:baseline` |
| Demo users appear | A migration ran without `--no-seed`; rotate those passwords immediately |
