import { RateLimiterMemory } from 'rate-limiter-flexible';
import { setResponseStatus } from '@tanstack/react-start/server';
import { RATE_LIMIT_DEFAULTS } from '@/lib/constants';

/**
 * Resolve the applied rate-limit window (ms) from DB settings, falling back to
 * env var, then default. Results are memoized briefly so hot paths (every
 * server fn) do not hit the DB on each call.
 */
let cachedWindowMs: number | null = null;
let cachedMax: number | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10_000;

async function resolveDbLimits(): Promise<{
  max: number;
  windowMs: number;
} | null> {
  const now = Date.now();
  if (cacheExpiresAt > now && cachedWindowMs !== null && cachedMax !== null) {
    return { max: cachedMax, windowMs: cachedWindowMs };
  }
  let limits: { max: number; windowMs: number } | null = null;
  try {
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const result = await getCompanySettings();
    const s = result?.settings;
    if (s?.rate_limit_max && s.rate_limit_window_ms) {
      limits = { max: s.rate_limit_max, windowMs: s.rate_limit_window_ms };
    }
  } catch {
    // DB unavailable — fall back to env/defaults below
  }
  if (limits) {
    cachedMax = limits.max;
    cachedWindowMs = limits.windowMs;
    cacheExpiresAt = now + CACHE_TTL_MS;
  }
  return limits;
}

export async function getAppliedRateLimits() {
  const dbLimits = await resolveDbLimits();
  const max =
    dbLimits?.max ?? parseInt(process.env.RATE_LIMIT_MAX || String(RATE_LIMIT_DEFAULTS.max), 10);
  const windowMs =
    dbLimits?.windowMs ??
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(RATE_LIMIT_DEFAULTS.windowMs), 10);
  return { max, windowMs };
}

/** Reset the memoized DB settings so the next read picks up changes. */
export function invalidateRateLimitCache() {
  cacheExpiresAt = 0;
}

let limiter: RateLimiterMemory | null = null;

async function getLimiter() {
  const { max, windowMs } = await getAppliedRateLimits();
  if (!limiter || limiter.points !== max || limiter.duration !== windowMs / 1000) {
    limiter = new RateLimiterMemory({ points: max, duration: windowMs / 1000 });
  }
  return limiter;
}

export async function checkRateLimit(key: string) {
  try {
    const limiter = await getLimiter();
    await limiter.consume(key);
  } catch {
    try {
      setResponseStatus(429);
    } catch {
      // not in server context — no-op
    }
    throw new Error('Rate limit exceeded');
  }
}
