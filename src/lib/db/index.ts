import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/kolonios';

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const postgresSpecifier = ['post', 'gres'].join('');

const isServer = typeof window === 'undefined';

const postgresModule = isServer ? await import(/* @vite-ignore */ postgresSpecifier) : undefined;
const client = isServer
  ? (globalForDb.client ??
    (postgresModule?.default(connectionString, { max: 10 }) as ReturnType<typeof postgres>))
  : undefined;
if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = isServer
  ? drizzle(client as ReturnType<typeof postgres>, { schema })
  : (undefined as unknown as ReturnType<typeof drizzle>);
export { client };
