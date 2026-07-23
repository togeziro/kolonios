// Creates (or resets) the isolated PostgreSQL test database used by Vitest
// integration tests. Idempotent: drops & recreates then pushes the schema.
//
//   bun run db:test:create
//
import { execSync } from 'node:child_process';

const TEST_DB = 'tanstack_dashboard_test';
const ADMIN_URL = 'postgres://tanstack:tanstack@localhost:5432/tanstack_dashboard';
const TEST_URL = `postgres://tanstack:tanstack@localhost:5432/${TEST_DB}`;

console.log(`Dropping database ${TEST_DB} (if it exists)...`);
execSync(`psql "${ADMIN_URL}" -c "DROP DATABASE IF EXISTS ${TEST_DB};"`, {
  stdio: 'inherit'
});

console.log(`Creating database ${TEST_DB}...`);
execSync(`psql "${ADMIN_URL}" -c "CREATE DATABASE ${TEST_DB};"`, { stdio: 'inherit' });

console.log('Pushing schema to test database...');
execSync(`DATABASE_URL="${TEST_URL}" bun run db:push`, { stdio: 'inherit' });

console.log(`Test database ${TEST_DB} ready.`);
