import { describe, expect, it } from 'vitest';
import { businessDateInTimeZone, businessTimeInTimeZone } from './dates';

describe('businessDateInTimeZone', () => {
  it('defaults to Asia/Jakarta (WIB)', () => {
    // 2026-08-04T17:30:00Z == 2026-08-05T00:30:00+07:00
    const result = businessDateInTimeZone('2026-08-04T17:30:00Z');
    expect(result).toBe('2026-08-05');
  });

  it('returns the same date before midnight in UTC', () => {
    // 2026-08-04T23:30:00Z == 2026-08-04T23:30:00+00:00
    const result = businessDateInTimeZone('2026-08-04T23:30:00Z', 'UTC');
    expect(result).toBe('2026-08-04');
  });

  it('crosses midnight into the next business day in WIB', () => {
    // 2026-08-04T20:30:00Z == 2026-08-05T03:30:00+07:00
    const result = businessDateInTimeZone('2026-08-04T20:30:00Z', 'Asia/Jakarta');
    expect(result).toBe('2026-08-05');
  });

  it('accepts a Date instance', () => {
    const result = businessDateInTimeZone(new Date('2026-08-04T17:30:00Z'));
    expect(result).toBe('2026-08-05');
  });
});

describe('businessTimeInTimeZone', () => {
  it('defaults to Asia/Jakarta (WIB), not the server timezone', () => {
    // 2026-09-15T08:14:52Z == 2026-09-15T15:14:52+07:00
    const result = businessTimeInTimeZone('2026-09-15T08:14:52Z');
    expect(result).toBe('15:14:52');
  });

  it('crosses midnight into the next business day in WIB', () => {
    // 2026-08-04T17:30:00Z == 2026-08-05T00:30:00+07:00
    const result = businessTimeInTimeZone('2026-08-04T17:30:00Z', 'Asia/Jakarta');
    expect(result).toBe('00:30:00');
  });

  it('honours an explicit timezone override', () => {
    const result = businessTimeInTimeZone('2026-09-15T08:14:52Z', 'UTC');
    expect(result).toBe('08:14:52');
  });
});
