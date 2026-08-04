import { RateLimiterMemory } from 'rate-limiter-flexible';
import { setResponseStatus } from '@tanstack/react-start/server';
import { RATE_LIMIT_DEFAULTS } from '@/lib/constants';

export const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX || String(RATE_LIMIT_DEFAULTS.max), 10),
  duration:
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(RATE_LIMIT_DEFAULTS.windowMs), 10) / 1000
});

export async function checkRateLimit(key: string) {
  try {
    await rateLimiter.consume(key);
  } catch {
    try {
      setResponseStatus(429);
    } catch {
      // not in server context — no-op
    }
    throw new Error('Rate limit exceeded');
  }
}
