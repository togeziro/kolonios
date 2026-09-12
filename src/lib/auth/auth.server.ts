import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/lib/db';
import { isPublicSignupEnabled } from '@/lib/env';
import { AUTH_RATE_LIMIT_DEFAULTS } from '@/lib/constants';

const DEV_TRUSTED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://172.17.16.3:3000',
  'http://172.17.16.3:3001',
  'https://172.17.16.3:8082'
];

/**
 * Trusted origins are deployment-specific: the public domain must be listed
 * or better-auth rejects sign-in with a CSRF/origin error. Origins come from
 * BETTER_AUTH_TRUSTED_ORIGINS (comma-separated) plus BETTER_AUTH_URL; the
 * localhost entries are added in development only.
 */
function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>();
  for (const origin of (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '').split(',')) {
    const trimmed = origin.trim();
    if (trimmed) origins.add(trimmed);
  }
  const baseUrl = process.env.BETTER_AUTH_URL?.trim();
  if (baseUrl) origins.add(baseUrl);
  if (process.env.NODE_ENV !== 'production') {
    for (const origin of DEV_TRUSTED_ORIGINS) origins.add(origin);
  }
  return [...origins];
}

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : {
        allowedHosts: ['localhost:*', '127.0.0.1:*', '172.17.16.3:*'],
        protocol: 'auto',
        fallback: 'http://localhost:3000'
      },
  trustedOrigins: resolveTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true,
    // Fail-closed: public self-registration stays off unless
    // ALLOW_PUBLIC_SIGNUP=true (see src/lib/env.ts).
    disableSignUp: !isPublicSignupEnabled()
  },
  plugins: [admin(), tanstackStartCookies()],
  rateLimit: {
    enabled: true,
    window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || AUTH_RATE_LIMIT_DEFAULTS.window),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || AUTH_RATE_LIMIT_DEFAULTS.max),
    customRules: {
      '/sign-in/email': {
        window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || AUTH_RATE_LIMIT_DEFAULTS.window),
        max: Number(process.env.AUTH_RATE_LIMIT_MAX_SIGNIN || AUTH_RATE_LIMIT_DEFAULTS.maxSignin)
      }
    }
  }
});
