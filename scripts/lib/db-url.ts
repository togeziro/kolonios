// Shared DATABASE_URL parsing for standalone scripts (reset / migrate / seed /
// test-db creation). Kept dependency-free apart from `postgres` so any script
// can import it under plain `bun`.
//
// Postgres.js runs DDL through `unsafe()` which does NOT escape parameters, so
// identifiers interpolated into DROP/CREATE statements must be validated here.

export const DEFAULT_DEV_DB_URL = 'postgres://tanstack:tanstack@localhost:5432/kolonios';

const DB_NAME_RE = /^[A-Za-z0-9_]+$/;
const POSTGRES_PROTOCOL_RE = /^postgres(?:ql)??:$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type DbUrlParts = {
  /** The connection string exactly as provided (env or fallback). */
  url: string;
  /** Database name parsed from the URL path, validated against DB_NAME_RE. */
  dbName: string;
  /** Same server/credentials, pointed at the `postgres` maintenance database. */
  adminUrl: string;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function buildUrl(raw: string, dbName: string): string {
  const url = new URL(raw);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Parses and validates DATABASE_URL. Exits the process with a clear message
 * when the value is missing or malformed. Never returns an unvalidated name.
 */
export function parseDbUrl(options: { fallback?: string } = {}): DbUrlParts {
  const raw = process.env.DATABASE_URL?.trim() || options.fallback;
  if (!raw) {
    fail(
      'DATABASE_URL is not set. Copy env.example.txt to .env (or export DATABASE_URL) and retry.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`DATABASE_URL is not a valid connection string: "${raw}"`);
  }

  if (!POSTGRES_PROTOCOL_RE.test(parsed.protocol)) {
    fail(`DATABASE_URL must be a postgres:// connection string, got protocol "${parsed.protocol}"`);
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!dbName || !DB_NAME_RE.test(dbName)) {
    fail(
      `DATABASE_URL database name "${dbName}" is missing or invalid (allowed: letters, digits, underscore).`
    );
  }
  if (dbName === 'postgres') {
    fail('Refusing to operate on the "postgres" maintenance database.');
  }

  return { url: raw, dbName, adminUrl: buildUrl(raw, 'postgres') };
}

/** Returns the connection string rewritten to point at `dbName`. */
export function withDbName(parts: DbUrlParts, dbName: string): string {
  if (!DB_NAME_RE.test(dbName)) {
    fail(`Database name "${dbName}" is invalid (allowed: letters, digits, underscore).`);
  }
  return buildUrl(parts.url, dbName);
}

/** Double-quoted SQL identifier. Only safe AFTER DB_NAME_RE validation. */
export function quoteIdent(dbName: string): string {
  if (!DB_NAME_RE.test(dbName)) {
    fail(`Database name "${dbName}" is invalid (allowed: letters, digits, underscore).`);
  }
  return `"${dbName}"`;
}

/** Guards destructive scripts against remote hosts unless explicitly forced. */
export function requireLocalHost(parts: DbUrlParts, options: { force?: boolean } = {}): void {
  const host = new URL(parts.url).hostname;
  if (LOCAL_HOSTS.has(host)) return;
  if (options.force) {
    console.warn(`--force: proceeding against NON-LOCAL host "${host}".`);
    return;
  }
  fail(
    `Refusing to run against non-local host "${host}" (destructive operation). ` +
      'Pass --force to override.'
  );
}
