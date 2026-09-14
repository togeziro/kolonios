# Initial login ceremony — Kolonios

Reproducible runbook for the first admin account on any fresh production
machine (prod VM, staging, internal VM). Companion to `docs/DEPLOY.md` §3.
Placeholders only below — never write live credentials, domains, or IPs
into this file or any other repo file.

Prerequisites (in order): the release containing migration `0039`
(`user.must_change_password`) and `src/lib/auth/password-gate.ts` is
deployed; `ALLOW_PUBLIC_SIGNUP` is not `'true'`; `BETTER_AUTH_SECRET` is
stable (rotating it logs everyone out).

## 0. Readiness (read-only, on the host via SSH)

```bash
grep -E 'ALLOW_PUBLIC_SIGNUP|BETTER_AUTH_URL|BETTER_AUTH_TRUSTED_ORIGINS' /etc/kolonios/kolonios.env
# expect: ALLOW_PUBLIC_SIGNUP=false (or anything other than 'true')

set -a; source /etc/kolonios/kolonios.env; set +a
psql "$DATABASE_URL" -c 'SELECT count(*) FROM "user";'
# expect: 0 on a fresh machine

sudo systemctl is-active kolonios
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Gate: if the user count is not 0, stop and audit who the rows belong to
before proceeding.

## 1. One-time credential (default: `--bootstrap`)

One command — no password to invent or transfer. The script generates a
unique random password per machine (≈32 chars), prints it ONCE to stdout
for the operator to copy, and flags the account for forced rotation, so the
bootstrap password is a single-use ticket, never a standing credential:

```bash
cd /opt/kolonios
set -a; source /etc/kolonios/kolonios.env; set +a
sudo -E -u kolonios bun run scripts/create-initial-admin.ts --bootstrap
# default account: admin@kolonios.local / "Administrator"
# (--email/--name override the defaults; --allow-existing only matters
#  when creating a NEW email on a machine that already has users)
```

- Hand over out-of-band (password manager / sealed note / voice). Never
  into repo files, issues, PRs, or shell history.
- Valid for this ceremony only; retired in step 3. Reruns for the same
  email always succeed (grants verified, password untouched, nothing
  printed) — so a lost output never bricks the operator; just re-run.
- Alternative (explicit password): `openssl rand -base64 24` piped via
  `--password-stdin`, or `$INITIAL_ADMIN_PASSWORD` — minimum 20 chars,
  and never combined with `--bootstrap` (the script refuses).

## 3. First login + forced rotation

1. Sign in through the public URL the users actually visit. An
   origin/CSRF error means `BETTER_AUTH_URL`/`BETTER_AUTH_TRUSTED_ORIGINS`
   is wrong — fix the env, restart, retry.
2. The rotation gate confines the session to `/dashboard/change-password`
   (banner shown, back button hidden). Set the real password there; the
   rotation is verified server-side in one step (current-password proof +
   other sessions revoked) and the flag clears only on success.
3. Confirm freedom: open another dashboard page — it must load, not bounce.

## 4. Hardening (in order, no skips)

1. **Registration closed, two layers:** `/auth/sign-up` redirects to
   sign-in (UI); direct `POST /api/v1/auth/sign-up/email` is rejected
   (API) and no probe row appears in `"user"`.
2. **User audit:** `SELECT id,email,role FROM "user"` returns exactly the
   known accounts; memberships in `user_role_groups` as expected.
3. **S3:** Admin → Storage Settings → test connection + one real upload.
4. **Daily ops user:** create a non-admin account for everyday work; the
   initial admin is for administration only.
5. **Onboarding later users (UI):** Users → Add User — the admin may set an
   initial password (min 8 chars) or leave both password fields blank to
   auto-generate a 14-char one-time credential, shown ONCE in a copy dialog
   for out-of-band handover (never stored, never audited). Every
   created/replaced password is a one-time credential: the account is
   flagged `must_change_password` and confined to change-password until the
   owner sets their own. Replacing a password is a row action (`…` →
   Replace password, `users.edit`); it is audited as `user.set_password`
   with `before/after: null` — the password itself is never audited.
   Failed creations leave a `user.create_failed` trail (email + reason, no
   password); partial creates are compensated server-side (orphan deleted)
   so a retry never hits "user already exists".

## 5. Contingency

Locked out with DB/SSH access: re-verify state
(`SELECT id,email,role FROM "user"`), clear stuck sessions
(`DELETE FROM session WHERE "user_id"='<id>'`), and rotate via the
change-password page once in. If the password itself is lost, delete the
user row and re-run step 2 with a fresh one-time credential. Never
`UPDATE account.password` by hand (scrypt), never seed prod, never rotate
`BETTER_AUTH_SECRET` to fix a login problem.

Abort the ceremony (stop, re-lock, investigate) when: signup is found
open outside a planned window; any unknown user/row appears; public login
fails after two origin fixes; the one-time credential touched the repo,
logs, or history (treat as burnt — start over with a fresh one); or any
script/secret trace is left on disk.
