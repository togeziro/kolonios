import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/kolonios';

// Reuse the client across hot reloads in dev so we don't exhaust connections.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const postgresSpecifier = ['post', 'gres'].join('');
const postgresModule =
  typeof window === 'undefined' ? await import(/* @vite-ignore */ postgresSpecifier) : undefined;
const client =
  globalForDb.client ??
  (postgresModule?.default(connectionString, { max: 10 }) as ReturnType<typeof postgres>);
if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
export { client };
