import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';

const TEST_LIMIT = 5;

describe('checkRateLimit', { timeout: 30000 }, () => {
  let checkRateLimit: (key: string) => Promise<void>;
  let getAppliedRateLimits: () => Promise<{ max: number; windowMs: number }>;

  beforeAll(async () => {
    vi.stubEnv('RATE_LIMIT_MAX', String(TEST_LIMIT));
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
    vi.resetModules();
    const mod = await import('./rate-limit');
    checkRateLimit = mod.checkRateLimit;
    getAppliedRateLimits = mod.getAppliedRateLimits;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('allows requests under the limit', async () => {
    await expect(checkRateLimit('test-key')).resolves.not.toThrow();
  });

  it('throws after exceeding limit', async () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < TEST_LIMIT; i++) {
      await checkRateLimit(key);
    }
    await expect(checkRateLimit(key)).rejects.toThrow('Rate limit exceeded');
  });

  it('limits keys independently (per-user isolation)', async () => {
    const keyA = `user-a-${Date.now()}`;
    const keyB = `user-b-${Date.now()}`;
    for (let i = 0; i < TEST_LIMIT; i++) {
      await checkRateLimit(keyA);
    }
    await expect(checkRateLimit(keyA)).rejects.toThrow('Rate limit exceeded');
    await expect(checkRateLimit(keyB)).resolves.not.toThrow();
  });

  it('falls back to env defaults when DB settings are absent', async () => {
    const limits = await getAppliedRateLimits();
    expect(limits).toEqual({ max: TEST_LIMIT, windowMs: 60_000 });
  });
});
