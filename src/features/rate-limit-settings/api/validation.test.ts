import { describe, expect, it } from 'vitest';
import { rateLimitSchema } from './validation';

describe('rateLimitSchema', () => {
  it('accepts valid limits', () => {
    expect(rateLimitSchema.safeParse({ max: 150, windowMs: 60_000 }).success).toBe(true);
  });

  it('rejects max below minimum', () => {
    expect(rateLimitSchema.safeParse({ max: 5, windowMs: 60_000 }).success).toBe(false);
  });

  it('rejects max above maximum', () => {
    expect(rateLimitSchema.safeParse({ max: 20_000, windowMs: 60_000 }).success).toBe(false);
  });

  it('rejects non-integer max', () => {
    expect(rateLimitSchema.safeParse({ max: 150.5, windowMs: 60_000 }).success).toBe(false);
  });

  it('rejects window below minimum', () => {
    expect(rateLimitSchema.safeParse({ max: 150, windowMs: 500 }).success).toBe(false);
  });

  it('rejects window above maximum', () => {
    expect(rateLimitSchema.safeParse({ max: 150, windowMs: 7_200_000 }).success).toBe(false);
  });
});
