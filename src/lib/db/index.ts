import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { resolveDatabaseUrl } from '../env';
import * as schema from './schema';

type PayrollDb = PostgresJsDatabase<typeof schema> & { $client: ReturnType<typeof postgres> };

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const postgresSpecifier = ['post', 'gres'].join('');
const drizzleAdapterSpecifier = ['drizzle-orm', 'postgres-js'].join('/');

const isServer = typeof window === 'undefined';

const postgresModule = isServer ? await import(/* @vite-ignore */ postgresSpecifier) : undefined;
const client = isServer
  ? (globalForDb.client ??
    (postgresModule?.default(resolveDatabaseUrl(), { max: 10 }) as ReturnType<typeof postgres>))
  : undefined;
if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = isServer
  ? ((await import(/* @vite-ignore */ drizzleAdapterSpecifier)).drizzle(client, {
      schema
    }) as PayrollDb)
  : (undefined as unknown as PayrollDb);
export { client };
