/**
 * Environment utility functions.
 * Use these helpers instead of directly accessing process.env.
 */

const nodeEnv = process.env.NODE_ENV;

export const isDev = nodeEnv === 'development';
export const isProd = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';

export const DEFAULT_DEV_DATABASE_URL = 'postgres://tanstack:tanstack@localhost:5432/kolonios';

/**
 * Environment variables that must be present before the production server
 * starts serving traffic. Failing fast here beats booting with a missing
 * secret and only discovering it on the first request that needs it.
 */
const PRODUCTION_REQUIRED_ENV = [
  'DATABASE_URL',
  'BETTER_AUTH_URL',
  'STORAGE_ENCRYPTION_KEY'
] as const;

export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Resolves the database connection string. In production a missing
 * DATABASE_URL is a hard error — the previous silent fallback to the local
 * development database could point a prod server at the wrong data.
 */
export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL is required in production; refusing to fall back to the development database.'
    );
  }
  return DEFAULT_DEV_DATABASE_URL;
}

/**
 * Validates required production environment variables. No-op outside
 * production. Accepts either BETTER_AUTH_SECRET or the legacy AUTH_SECRET
 * because better-auth reads both.
 */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window !== 'undefined') return;

  const missing: string[] = PRODUCTION_REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (!process.env.BETTER_AUTH_SECRET && !process.env.AUTH_SECRET) {
    missing.push('BETTER_AUTH_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
  }
}
