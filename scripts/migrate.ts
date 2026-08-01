import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connection = postgres(process.env.DATABASE_URL || '');
const db = drizzle(connection);

async function isUserTableEmpty(): Promise<boolean> {
  const rows = await db.execute<{ count: string }>('SELECT count(*)::text AS count FROM "user"');
  return Number(rows[0]?.count ?? 0) === 0;
}

async function main() {
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  console.log('Migrations applied');

  if (await isUserTableEmpty()) {
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
