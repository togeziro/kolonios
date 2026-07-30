import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', { timeout: 30000 }, () => {
  it('allows requests under the limit', async () => {
    await expect(checkRateLimit('test-key')).resolves.not.toThrow();
  });

  it('throws after exceeding limit', async () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      await checkRateLimit(key);
    }
    await expect(checkRateLimit(key)).rejects.toThrow('Rate limit exceeded');
  });
});
