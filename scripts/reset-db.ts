import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import postgres from 'postgres';
import { parseDbUrl, quoteIdent, requireLocalHost } from './lib/db-url';

// Dev equivalent of Laravel's `migrate:fresh --seed` / Prisma's `migrate reset`:
// drop whatever database DATABASE_URL names, recreate it, re-apply every
// versioned migration, and seed demo data. Guards refuse non-local hosts and
// the `postgres` maintenance DB (see lib/db-url).

function parseFlags() {
  const args = process.argv.slice(2);
  return {
    yes: args.includes('--yes'),
    force: args.includes('--force')
  };
}

async function confirmDrop(dbName: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      'Non-interactive shell detected. Re-run with --yes to skip the confirmation prompt.'
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await rl.question(`Drop and recreate database "${dbName}"? All data will be lost. [y/N] `)
    )
      .trim()
      .toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const flags = parseFlags();
  // No fallback on purpose: a destructive script must not guess a database.
  const parts = parseDbUrl();
  requireLocalHost(parts, { force: flags.force });

  if (!flags.yes && !(await confirmDrop(parts.dbName))) {
    console.log('Aborted.');
    return;
  }

  const admin = postgres(parts.adminUrl, { max: 1, onnotice: () => {} });
  try {
    console.log(`Terminating connections to ${parts.dbName}...`);
    await admin.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [parts.dbName]
    );

    console.log(`Dropping database ${parts.dbName}...`);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(parts.dbName)}`);

    console.log(`Creating database ${parts.dbName}...`);
    await admin.unsafe(`CREATE DATABASE ${quoteIdent(parts.dbName)}`);
  } finally {
    await admin.end();
  }

  const run = (script: string) =>
    execSync(script, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: parts.url }
    });

  run('bun run db:migrate:run -- --no-seed');
  run('bun run db:seed');

  const check = postgres(parts.url, { max: 1, onnotice: () => {} });
  try {
    const rows = await check.unsafe<{ users: string; tickets: string; customers: string }[]>(
      `SELECT
         (SELECT count(*) FROM "user") AS users,
         (SELECT count(*) FROM tickets) AS tickets,
         (SELECT count(*) FROM customers) AS customers`
    );
    const counts = rows[0];
    console.log(
      `Reset complete: ${parts.dbName} has ${counts?.users ?? '?'} users, ` +
        `${counts?.tickets ?? '?'} tickets, ${counts?.customers ?? '?'} customers.`
    );
  } finally {
    await check.end();
  }
  console.log('Demo login: admin@example.com / Password123!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
