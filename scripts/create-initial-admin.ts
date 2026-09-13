/**
 * Creates the first (or an additional) admin account without ever opening
 * public registration.
 *
 * Server-side equivalent of the better-auth admin `createUser` endpoint
 * (same code path the seed uses): `auth.api.createUser` hashes the password
 * with scrypt and links the credential account, bypassing `disableSignUp`
 * with no public window and no service restart. Direct SQL inserts are NOT
 * used — the scrypt hash cannot be hand-crafted.
 *
 * Reusable across machines (fresh prod, staging, internal VM): all inputs
 * come from argv/env/stdin, never from files. No credentials, URLs, or IPs
 * are written anywhere by this script.
 *
 * Usage (as the service user, env sourced from the host env file):
 *   set -a; source /etc/kolonios/kolonios.env; set +a
 *   openssl rand -base64 24 | bun run scripts/create-initial-admin.ts \
 *     --email ops@example.com --name "Ops Admin" --password-stdin
 *   # or: INITIAL_ADMIN_PASSWORD='<secret>' bun run scripts/create-initial-admin.ts \
 *   #   --email ops@example.com --name "Ops Admin"
 *
 * Guards (fail-closed):
 * - refuses when the user table is non-empty unless --allow-existing
 * - refuses passwords shorter than 20 characters
 * - existing email → verifies admin grants, leaves the password untouched,
 *   exits 0 (idempotent reruns are safe)
 *
 * Every created account starts with must_change_password=true, so the
 * dashboard confines it to /dashboard/change-password until the owner sets
 * a fresh password (see src/lib/auth/password-gate.ts).
 */

import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db, client as dbClient } from '../src/lib/db';
import { auth } from '../src/lib/auth/auth.server';
import { account, user } from '../src/lib/db/auth-schema';
import { roleGroups } from '../src/lib/db/schema/role-groups';
import { userRoleGroups } from '../src/lib/db/schema/user-role-groups';

const ADMIN_GROUP_ID = 'zzzrg-admin';
const MIN_PASSWORD_LENGTH = 20;

function usage(): never {
  console.error(
    [
      'Usage: bun run scripts/create-initial-admin.ts --email <email> --name <name> [--password-stdin] [--allow-existing]',
      '  Password source (in order): --password-stdin | $INITIAL_ADMIN_PASSWORD',
      `  Refuses passwords shorter than ${MIN_PASSWORD_LENGTH} characters.`
    ].join('\n')
  );
  process.exit(2);
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function readPasswordStdin(): Promise<string> {
  // Block until EOF: stdin is a pipe in the documented usage
  // (openssl ... | bun run scripts/create-initial-admin.ts ... --password-stdin).
  // Refuse a TTY instead of hanging silently when the operator forgets the pipe.
  if (process.stdin.isTTY) {
    console.error(
      'Refusing to read password from a terminal: pipe it via --password-stdin or set $INITIAL_ADMIN_PASSWORD.'
    );
    process.exit(2);
  }
  return readFileSync(0, 'utf-8').trim();
}

async function ensureAdminGrants(userId: string): Promise<void> {
  await db
    .insert(roleGroups)
    .values({
      id: ADMIN_GROUP_ID,
      name: 'Administrator',
      description: 'Full system access',
      permissions: {},
      is_admin: true
    })
    .onConflictDoNothing({ target: roleGroups.id });
  await db
    .insert(userRoleGroups)
    .values({ user_id: userId, role_group_id: ADMIN_GROUP_ID })
    .onConflictDoNothing({ target: userRoleGroups.user_id });
  await db.update(user).set({ role: 'admin' }).where(eq(user.id, userId));
}

async function main() {
  const email = argValue('--email')?.trim();
  const name = argValue('--name')?.trim();
  const allowExisting = process.argv.includes('--allow-existing');
  if (!email || !name || !email.includes('@')) usage();

  let password = '';
  if (process.argv.includes('--password-stdin')) {
    password = await readPasswordStdin();
  } else if (process.env.INITIAL_ADMIN_PASSWORD) {
    password = process.env.INITIAL_ADMIN_PASSWORD;
  }
  if (!password) {
    console.error('Missing password: pipe it via --password-stdin or set $INITIAL_ADMIN_PASSWORD.');
    await dbClient?.end();
    process.exit(2);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Refusing weak initial password (got ${password.length} chars, need >= ${MIN_PASSWORD_LENGTH}).`
    );
    await dbClient?.end();
    process.exit(1);
  }

  const countRows = await dbClient?.unsafe<{ count: string }[]>(
    'SELECT count(*)::text AS count FROM "user"'
  );
  const count = countRows?.[0]?.count ?? '0';
  if (Number(count) > 0 && !allowExisting) {
    console.error(
      `Refusing: user table already has ${count} row(s). Re-run with --allow-existing to create an additional admin.`
    );
    await dbClient?.end();
    process.exit(1);
  }

  const existing = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email!))
    .limit(1);
  if (existing.length > 0) {
    await ensureAdminGrants(existing[0].id);
    await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, existing[0].id));
    console.log(`User ${email} already exists — admin grants verified, password untouched.`);
    await dbClient?.end();
    return;
  }

  const created: any = await (auth.api as any).createUser({
    body: { email: email!, name: name!, password, role: 'admin' }
  });
  const userId: string | undefined = created?.user?.id ?? created?.id;
  if (!userId) {
    console.error('createUser returned no user id — aborting before granting roles.');
    await dbClient?.end();
    process.exit(1);
  }

  await ensureAdminGrants(userId);
  await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, userId));

  const creds = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, userId))
    .limit(1);
  const hasCredential = creds.length > 0;
  console.log(
    `Created admin ${email} (id ${userId}). credential_account=${hasCredential ? 'present' : 'MISSING'} must_change_password=true.`
  );
  if (!hasCredential) {
    await dbClient?.end();
    process.exit(1);
  }
  await dbClient?.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await dbClient?.end();
  } catch {
    // ignore cleanup errors after a failure
  }
  process.exit(1);
});
