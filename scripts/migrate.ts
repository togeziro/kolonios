import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connection = postgres(process.env.DATABASE_URL || '');
const db = drizzle(connection);
const migrationsFolder = './src/lib/db/migrations';

async function isUserTableEmpty(): Promise<boolean> {
  const rows = await db.execute<{ count: string }>('SELECT count(*)::text AS count FROM "user"');
  return Number(rows[0]?.count ?? 0) === 0;
}

// Pre-flight drift guard: if the database already contains tables that a not-yet-applied
// migration would create, it was managed with `db:push` (which never journals migrations).
// Running the migrator then would crash with `relation "..." already exists` (42P07), so we
// fail fast with actionable guidance instead of a raw postgres stack.
async function detectPushDrift(): Promise<string[] | null> {
  const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf-8')) as {
    entries: { tag: string; when: number }[];
  };

  let lastApplied: number | null = null;
  try {
    const rows = await connection.unsafe<{ created_at: number }[]>(
      'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1'
    );
    lastApplied = rows[0]?.created_at ?? null;
  } catch {
    // No journal table yet — brand-new database, no drift possible.
    return null;
  }
  if (lastApplied === null) return null;

  // Mirrors drizzle's own "apply when newer than last applied" logic (pg-core/dialect.js).
  const pending = journal.entries.filter((e) => e.when > lastApplied!);
  if (pending.length === 0) return null;

  const createdTables = new Set<string>();
  for (const entry of pending) {
    const sql = readFileSync(`${migrationsFolder}/${entry.tag}.sql`, 'utf-8');
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z_]+)"?/g)) {
      createdTables.add(match[1]);
    }
  }
  if (createdTables.size === 0) return null;

  const existing = new Set<string>();
  for (const table of createdTables) {
    const rows = await connection.unsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS exists`
    );
    if (rows[0]?.exists) existing.add(table);
  }

  return existing.size > 0 ? [...existing] : null;
}

async function main() {
  const noSeed = process.argv.includes('--no-seed');

  const drifted = await detectPushDrift();
  if (drifted) {
    console.error(
      [
        `Drift detected: database already contains table(s) [${drifted.join(', ')}] that pending migration(s) would create.`,
        'This database was managed with `db:push`, which never records migrations in the journal.',
        'Reconcile once with:',
        '  bun run db:baseline',
        'then re-run `bun run db:migrate:run`. Going forward, use `db:generate` -> `db:migrate:run` only.'
      ].join('\n')
    );
    await connection.end();
    process.exit(1);
  }

  await migrate(db, { migrationsFolder });
  console.log('Migrations applied');

  if (noSeed) {
    console.log('--no-seed: skipping auto-seed');
  } else if (await isUserTableEmpty()) {
    console.log('User table is empty — seeding demo data...');
    const { seedDatabase } = await import('./seed');
    await seedDatabase();
  } else {
    console.log('User table already has data — skipping seed');
  }

  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
