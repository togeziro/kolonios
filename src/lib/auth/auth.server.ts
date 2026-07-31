import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/lib/db';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : {
        allowedHosts: ['localhost:*', '127.0.0.1:*', '172.17.16.3:*'],
        protocol: 'auto',
        fallback: 'http://localhost:3000'
      },
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [admin(), tanstackStartCookies()],
  rateLimit: {
    enabled: true,
    window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 60),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 100),
    customRules: {
      '/sign-in/email': {
        window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 60),
        max: Number(process.env.AUTH_RATE_LIMIT_MAX_SIGNIN || 5)
      }
    }
  }
});
