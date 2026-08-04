/**
 * Environment utility functions.
 * Use these helpers instead of directly accessing process.env.
 */

const nodeEnv = process.env.NODE_ENV;

export const isDev = nodeEnv === 'development';
export const isProd = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';

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
