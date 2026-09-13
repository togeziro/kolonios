import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DEV_DB_URL, parseDbUrl, quoteIdent, withDbName } from './lib/db-url';

// Black-box tests for scripts/create-initial-admin.ts against a dedicated
// throwaway database (never kolonios_test — other suites run in parallel
// workers). Each run spawns the real script, so arg parsing, guards, hashing,
// grants, and the must_change_password flag are all exercised end to end.
const source = parseDbUrl({ fallback: DEFAULT_DEV_DB_URL });
const TEST_DB = `${source.dbName}_bootstrap_test`;
const TEST_URL = withDbName(source, TEST_DB);
const TEST_SECRET = 'bootstrap-test-secret-0123456789abcdef';

function runScript(
  args: string[],
  extraEnv: Record<string, string> = {}
): {
  status: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execFileSync('bun', ['run', 'scripts/create-initial-admin.ts', ...args], {
      encoding: 'utf-8',
      env: { ...process.env, DATABASE_URL: TEST_URL, BETTER_AUTH_SECRET: TEST_SECRET, ...extraEnv }
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return {
      status: e.status ?? 1,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? '')
    };
  }
}

function bootstrapPasswordFrom(stdout: string): string | null {
  const lines = stdout.split('\n');
  const marker = lines.findIndex((l) => l.includes('BOOTSTRAP PASSWORD'));
  if (marker < 0 || marker + 1 >= lines.length) return null;
  return lines[marker + 1].trim() || null;
}

async function truncateUsers() {
  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe('TRUNCATE "user" CASCADE');
  } finally {
    await sql.end();
  }
}

async function getUser(email: string) {
  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql.unsafe(
      `SELECT u.id, u.email, u.role, u.must_change_password AS "mustChangePassword",
              (SELECT count(*)::int FROM account a WHERE a.user_id = u.id) AS "credentialCount",
              (SELECT count(*)::int FROM user_role_groups g WHERE g.user_id = u.id AND g.role_group_id = 'zzzrg-admin') AS "adminGrants"
         FROM "user" u WHERE u.email = $1`,
      [email]
    );
    return rows[0] as unknown as
      | {
          id: string;
          email: string;
          role: string;
          mustChangePassword: boolean;
          credentialCount: number;
          adminGrants: number;
        }
      | undefined;
  } finally {
    await sql.end();
  }
}

beforeAll(async () => {
  const admin = postgres(source.adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB]
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(TEST_DB)}`);
    await admin.unsafe(`CREATE DATABASE ${quoteIdent(TEST_DB)}`);
  } finally {
    await admin.end();
  }
  execFileSync('bun', ['run', 'db:migrate:run', '--', '--no-seed'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_URL }
  });
}, 180000);

afterAll(async () => {
  const admin = postgres(source.adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB]
    );
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(TEST_DB)}`);
  } finally {
    await admin.end();
  }
});

describe('create-initial-admin --bootstrap', () => {
  it('creates the default admin with a printed one-time password and the rotation flag', async () => {
    await truncateUsers();
    const run = runScript(['--bootstrap']);
    expect(run.status).toBe(0);
    const password = bootstrapPasswordFrom(run.stdout);
    expect(password).not.toBeNull();
    expect(password!.length).toBeGreaterThanOrEqual(20);

    const created = await getUser('admin@kolonios.local');
    expect(created).toBeDefined();
    expect(created!.role).toBe('admin');
    expect(created!.mustChangePassword).toBe(true);
    expect(created!.credentialCount).toBeGreaterThanOrEqual(1);
    expect(created!.adminGrants).toBe(1);
  }, 60000);

  it('rerun is idempotent and prints no password', async () => {
    await truncateUsers();
    expect(runScript(['--bootstrap']).status).toBe(0);
    const rerun = runScript(['--bootstrap']);
    expect(rerun.status).toBe(0);
    expect(rerun.stdout).toContain('already exists');
    expect(rerun.stdout).not.toContain('BOOTSTRAP PASSWORD');
  }, 60000);

  it('refuses a non-empty user table without --allow-existing', async () => {
    await truncateUsers();
    expect(runScript(['--bootstrap']).status).toBe(0);
    const second = runScript(['--bootstrap', '--email', 'second@local']);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain('already has 1 row');
    expect(await getUser('second@local')).toBeUndefined();
  }, 60000);

  it('refuses an ambiguous password source', async () => {
    const viaStdin = runScript(['--bootstrap', '--password-stdin']);
    expect(viaStdin.status).toBe(2);
    expect(viaStdin.stderr).toContain('Ambiguous password source');

    const viaEnv = runScript(['--bootstrap'], { INITIAL_ADMIN_PASSWORD: 'x'.repeat(24) });
    expect(viaEnv.status).toBe(2);
    expect(viaEnv.stderr).toContain('Ambiguous password source');
  }, 60000);

  it('honours --email/--name overrides and generates a fresh password per run', async () => {
    await truncateUsers();
    const first = runScript(['--bootstrap', '--email', 'ops@example.com', '--name', 'Ops']);
    expect(first.status).toBe(0);
    const pw1 = bootstrapPasswordFrom(first.stdout);
    expect(await getUser('ops@example.com')).toBeDefined();

    await truncateUsers();
    const second = runScript(['--bootstrap', '--email', 'ops@example.com', '--name', 'Ops']);
    expect(second.status).toBe(0);
    const pw2 = bootstrapPasswordFrom(second.stdout);
    expect(pw1).not.toBeNull();
    expect(pw2).not.toBeNull();
    expect(pw1).not.toBe(pw2);
  }, 90000);
});
