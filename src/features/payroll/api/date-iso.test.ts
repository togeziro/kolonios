import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { parseDateISO } from './date-iso';

describe('parseDateISO', () => {
  it('returns a valid YYYY-MM-DD string unchanged', () => {
    expect(parseDateISO('2026-07-16')).toBe('2026-07-16');
    expect(parseDateISO('1999-12-31')).toBe('1999-12-31');
  });

  it.each([
    ['not a date'],
    ['2026/07/16'],
    ['16-07-2026'],
    ['2026-7-16'],
    ['2026-07-1'],
    [''],
    ['2026-07']
  ])('throws DomainError with code INVALID_DATE for %j', (input) => {
    expect(() => parseDateISO(input)).toThrowError(DomainError);
    expect(() => parseDateISO(input)).toThrowError(
      expect.objectContaining({ code: 'INVALID_DATE' })
    );
  });
});
