import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertProductionEnv,
  DEFAULT_DEV_DATABASE_URL,
  isPublicSignupEnabled,
  resolveDatabaseUrl
} from './env';

const MANAGED_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'BETTER_AUTH_URL',
  'STORAGE_ENCRYPTION_KEY',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'ALLOW_PUBLIC_SIGNUP'
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('resolveDatabaseUrl', () => {
  it('returns DATABASE_URL when set', () => {
    process.env.DATABASE_URL = 'postgres://kolonios:secret@db:5432/kolonios';
    expect(resolveDatabaseUrl()).toBe('postgres://kolonios:secret@db:5432/kolonios');
  });

  it('falls back to the dev database outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(resolveDatabaseUrl()).toBe(DEFAULT_DEV_DATABASE_URL);
  });

  it('throws in production instead of using the dev database', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveDatabaseUrl()).toThrow(/DATABASE_URL is required in production/);
  });
});

describe('assertProductionEnv', () => {
  it('is a no-op outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('lists every missing variable in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertProductionEnv()).toThrow(
      /DATABASE_URL, BETTER_AUTH_URL, STORAGE_ENCRYPTION_KEY, BETTER_AUTH_SECRET/
    );
  });

  it('passes when all required variables are present', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.BETTER_AUTH_URL = 'https://app.example.com';
    process.env.STORAGE_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.BETTER_AUTH_SECRET = 'b'.repeat(64);
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('accepts the legacy AUTH_SECRET name', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.BETTER_AUTH_URL = 'https://app.example.com';
    process.env.STORAGE_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.AUTH_SECRET = 'b'.repeat(64);
    expect(() => assertProductionEnv()).not.toThrow();
  });
});

describe('isPublicSignupEnabled', () => {
  it('is fail-closed when unset', () => {
    expect(isPublicSignupEnabled()).toBe(false);
  });

  it('opens only on the literal string true', () => {
    process.env.ALLOW_PUBLIC_SIGNUP = 'true';
    expect(isPublicSignupEnabled()).toBe(true);
  });

  it.each(['1', 'yes', 'TRUE', ''])('stays closed for %j', (value) => {
    process.env.ALLOW_PUBLIC_SIGNUP = value;
    expect(isPublicSignupEnabled()).toBe(false);
  });
});
