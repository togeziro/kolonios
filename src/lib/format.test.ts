import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  it('returns an empty string for falsy input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null as unknown as undefined)).toBe('');
  });

  it('formats a date with the default options', () => {
    expect(formatDate(new Date('2026-07-31T00:00:00Z'))).toBe('July 31, 2026');
  });

  it('honors custom options', () => {
    expect(
      formatDate('2026-07-31T00:00:00Z', { month: 'short', day: '2-digit', year: '2-digit' })
    ).toBe('Jul 31, 26');
  });

  it('returns an empty string when the date is invalid', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});
