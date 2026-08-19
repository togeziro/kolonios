import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/lib/db';
import { AUTH_RATE_LIMIT_DEFAULTS } from '@/lib/constants';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : {
        allowedHosts: ['localhost:*', '127.0.0.1:*', '172.17.16.3:*'],
        protocol: 'auto',
        fallback: 'http://localhost:3000'
      },
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://172.17.16.3:3000',
    'http://172.17.16.3:3001',
    'https://172.17.16.3:8082'
  ],
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true
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
