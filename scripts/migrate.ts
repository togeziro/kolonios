import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connection = postgres(process.env.DATABASE_URL || '');
const db = drizzle(connection);

async function main() {
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  console.log('Migrations applied');
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
