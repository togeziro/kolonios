import { RateLimiterMemory } from 'rate-limiter-flexible';

export const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000
});

export async function checkRateLimit(key: string) {
  try {
    await rateLimiter.consume(key);
  } catch {
    throw new Error('Rate limit exceeded');
  }
}
