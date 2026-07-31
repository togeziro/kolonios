import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const connection = postgres(process.env.DATABASE_URL || '');
const migrationsFolder = './src/lib/db/migrations';

async function main() {
  const journal = JSON.parse(
    readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf-8'),
  );

  await connection.unsafe(
    `CREATE SCHEMA IF NOT EXISTS drizzle; CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );`,
  );

  const rows = await connection.unsafe<{ created_at: number }[]>(
    `SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
  );
  const last = rows[0]?.created_at ?? null;

  let inserted = 0;
  for (const entry of journal.entries) {
    if (last !== null && Number(last) >= entry.when) continue;
    const sql = readFileSync(`${migrationsFolder}/${entry.tag}.sql`, 'utf-8');
    const hash = createHash('sha256').update(sql).digest('hex');
    await connection.unsafe(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, entry.when],
    );
    inserted++;
  }

  console.log(`Baseline complete: ${inserted} migration(s) recorded as applied (${journal.entries.length} total).`);
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
