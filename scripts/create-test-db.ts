import { execSync } from 'node:child_process';
import postgres from 'postgres';
import { DEFAULT_DEV_DB_URL, parseDbUrl, quoteIdent, withDbName } from './lib/db-url';

// Recreates the throwaway integration-test database ("<db>_test") from the
// current migrations, without seed data (tests bring their own fixtures).
//
// The target is derived from DATABASE_URL so non-default environments work:
// - local dev (.env → kolonios)          → kolonios_test
// - CI (DATABASE_URL=kolonios_test)      → kolonios_test (unchanged)
async function main() {
  const source = parseDbUrl({ fallback: DEFAULT_DEV_DB_URL });
  const testDbName = source.dbName.endsWith('_test') ? source.dbName : `${source.dbName}_test`;
  const testUrl = withDbName(source, testDbName);

  const sql = postgres(source.adminUrl, { max: 1, onnotice: () => {} });
  try {
    console.log(`Terminating connections to ${testDbName}...`);
    await sql.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName]
    );

    console.log(`Dropping database ${testDbName} (if it exists)...`);
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(testDbName)}`);

    console.log(`Creating database ${testDbName}...`);
    await sql.unsafe(`CREATE DATABASE ${quoteIdent(testDbName)}`);
  } finally {
    await sql.end();
  }

  console.log('Applying migrations to test database...');
  execSync('bun run db:migrate:run -- --no-seed', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl }
  });

  console.log(`Test database ${testDbName} ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
