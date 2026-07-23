// Global Vitest setup.
//
// Runs before every test file. We point DATABASE_URL at the dedicated test
// database here as a belt-and-suspenders measure on top of the `test.env`
// value in vite.config.ts, so the data-access modules (which read
// DATABASE_URL at import time) always connect to the isolated test DB rather
// than the developer's seeded dev database.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/tanstack_dashboard_test';
