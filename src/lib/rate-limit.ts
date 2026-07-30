import { RateLimiterMemory } from 'rate-limiter-flexible';
import { setResponseStatus } from '@tanstack/react-start/server';

export const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000
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
