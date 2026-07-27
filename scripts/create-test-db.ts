import { execSync } from 'node:child_process';
import postgres from 'postgres';

const TEST_DB = 'kolonios_test';
const ADMIN_URL = process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/kolonios';
const TEST_URL = `postgres://tanstack:tanstack@localhost:5432/${TEST_DB}`;

async function main() {
  const sql = postgres(ADMIN_URL, { onnotice: () => {} });

  console.log(`Terminating connections to ${TEST_DB}...`);
  await sql.unsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid != pg_backend_pid()`
  );

  console.log(`Dropping database ${TEST_DB} (if it exists)...`);
  await sql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);

  console.log(`Creating database ${TEST_DB}...`);
  await sql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

  await sql.end();

  console.log('Pushing schema to test database...');
  execSync(`DATABASE_URL="${TEST_URL}" bun run db:push`, { stdio: 'inherit' });

  console.log(`Test database ${TEST_DB} ready.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
