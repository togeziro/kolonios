// Pure payroll engine — effective-date resolution, PTKP table, JKK rates.
// No DB, no IO, no clock. These tests run without fixtures.
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import {
  JKK_RATES,
  PTKP_STATUS_ANNUAL,
  assertDateRange,
  assertEffectiveDate,
  mapPtkpStatusToAmount,
  requireEffectiveRecord,
  resolveEffectiveRecord,
  resolveEffectiveRecords,
  validatePayrollDateRange
} from './engine';

describe('assertEffectiveDate', () => {
  it('accepts well-formed ISO calendar dates', () => {
    expect(() => assertEffectiveDate('2026-08-01')).not.toThrow();
    expect(() => assertEffectiveDate('2000-02-29')).not.toThrow();
    expect(() => assertEffectiveDate('9999-12-31')).not.toThrow();
  });

  it('rejects malformed, partial, or impossible dates', () => {
    expect(() => assertEffectiveDate('2026/08/01')).toThrow(DomainError);
    expect(() => assertEffectiveDate('2026-8-1')).toThrow(DomainError);
    expect(() => assertEffectiveDate('2026-02-30')).toThrow(DomainError);
    expect(() => assertEffectiveDate('not-a-date')).toThrow(DomainError);
    expect(() => assertEffectiveDate('')).toThrow(DomainError);
  });
});

describe('assertDateRange / validatePayrollDateRange', () => {
  it('accepts start <= end', () => {
    expect(() => assertDateRange('2026-08-01', '2026-08-31')).not.toThrow();
    expect(() => assertDateRange('2026-08-01', '2026-08-01')).not.toThrow();
    expect(() => validatePayrollDateRange('2026-07-01', '2026-07-31')).not.toThrow();
  });

  it('rejects start > end', () => {
    expect(() => assertDateRange('2026-08-01', '2026-07-31')).toThrow(/start/i);
    expect(() => validatePayrollDateRange('2026-08-01', '2026-07-31')).toThrow(/start/i);
  });

  it('rejects malformed dates in the range', () => {
    expect(() => assertDateRange('nope', '2026-07-31')).toThrow(DomainError);
    expect(() => assertDateRange('2026-08-01', 'nope')).toThrow(DomainError);
  });
});

describe('resolveEffectiveRecord', () => {
  it('resolves the latest record covering the as-of date', () => {
    const records = [
      { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
      { id: 2, effective_from: '2026-07-01', effective_to: null }
    ];
    expect(resolveEffectiveRecord('emp-1', '2026-08-01', records)).toEqual(records[1]);
    expect(resolveEffectiveRecord('emp-1', '2026-05-01', records)).toEqual(records[0]);
  });

  it('returns null when no record covers the as-of date', () => {
    const records = [
      { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
      { id: 2, effective_from: '2026-07-01', effective_to: null }
    ];
    expect(resolveEffectiveRecord('emp-1', '2025-12-01', records)).toBeNull();
  });

  it('treats a null effective_to as open-ended (current record)', () => {
    const records = [{ id: 7, effective_from: '2020-01-01', effective_to: null }];
    expect(resolveEffectiveRecord('emp-1', '2099-12-31', records)).toEqual(records[0]);
  });

  it('throws when two records overlap at the as-of date', () => {
    expect(() =>
      resolveEffectiveRecord('emp-1', '2026-05-01', [
        { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
        { id: 3, effective_from: '2026-04-01', effective_to: '2026-08-01' }
      ])
    ).toThrow(/overlap/i);
  });

  it('rejects an invalid as-of date', () => {
    expect(() => resolveEffectiveRecord('emp-1', 'not-a-date', [])).toThrow(DomainError);
  });
});

describe('resolveEffectiveRecords', () => {
  it('returns every distinct record that is active on or after the start within the period', () => {
    const rows = [
      { id: 1, effective_from: '2026-01-01', effective_to: '2026-06-30' },
      { id: 2, effective_from: '2026-07-01', effective_to: '2026-07-15' },
      { id: 3, effective_from: '2026-07-16', effective_to: null },
      { id: 4, effective_from: '2026-08-01', effective_to: null }
    ];
    expect(resolveEffectiveRecords('emp-1', '2026-07-01', '2026-07-31', rows)).toEqual([
      rows[1],
      rows[2]
    ]);
  });

  it('sorts the result by effective_from ascending', () => {
    const rows = [
      { id: 5, effective_from: '2026-03-01', effective_to: '2026-04-30' },
      { id: 2, effective_from: '2026-01-01', effective_to: '2026-02-28' },
      { id: 4, effective_from: '2026-05-01', effective_to: null }
    ];
    const result = resolveEffectiveRecords('emp-1', '2026-01-01', '2026-12-31', rows);
    expect(result.map((r) => r.id)).toEqual([2, 5, 4]);
  });

  it('returns an empty array when no rows are active during the period', () => {
    const rows = [
      { id: 1, effective_from: '2025-01-01', effective_to: '2025-12-31' },
      { id: 2, effective_from: '2027-01-01', effective_to: null }
    ];
    expect(resolveEffectiveRecords('emp-1', '2026-01-01', '2026-12-31', rows)).toEqual([]);
  });

  it('rejects an invalid period range', () => {
    const rows = [{ id: 1, effective_from: '2026-01-01', effective_to: null }];
    expect(() => resolveEffectiveRecords('emp-1', '2026-12-31', '2026-01-01', rows)).toThrow(
      /start/i
    );
  });
});

describe('requireEffectiveRecord', () => {
  it('returns the resolved record when one exists', () => {
    const records = [{ id: 1, effective_from: '2026-01-01', effective_to: null }];
    expect(requireEffectiveRecord('emp-1', '2026-08-01', records)).toEqual(records[0]);
  });

  it('throws MISSING_PAYROLL_DATA when no record covers the as-of date', () => {
    expect(() => requireEffectiveRecord('emp-1', '2026-08-01', [])).toThrow(
      /required payroll data/i
    );
  });
});

describe('mapPtkpStatusToAmount', () => {
  it('returns the monthly PTKP for every valid status (annual / 12, rounded)', () => {
    for (const [status, annual] of Object.entries(PTKP_STATUS_ANNUAL)) {
      expect(mapPtkpStatusToAmount(status)).toBe(Math.round(annual / 12));
    }
  });

  it('covers all eight TK/0..K/3 status codes', () => {
    const codes = Object.keys(PTKP_STATUS_ANNUAL);
    expect(codes).toEqual(['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3']);
  });

  it('throws INVALID_PTKP_STATUS for unknown codes', () => {
    expect(() => mapPtkpStatusToAmount('ZZ/9')).toThrow(DomainError);
    expect(() => mapPtkpStatusToAmount('tk/0')).toThrow(/invalid ptkp status/i);
    expect(() => mapPtkpStatusToAmount('')).toThrow(/invalid ptkp status/i);
    expect(() => mapPtkpStatusToAmount('TK0')).toThrow(/invalid ptkp status/i);
  });
});

describe('JKK_RATES', () => {
  it('exposes one rate per risk category', () => {
    const categories = Object.keys(JKK_RATES).toSorted();
    expect(categories).toEqual(['high', 'low', 'medium', 'very_high', 'very_low']);
  });

  it('uses the canonical Indonesian JKK rates', () => {
    expect(JKK_RATES.very_low).toBe(0.24);
    expect(JKK_RATES.low).toBe(0.54);
    expect(JKK_RATES.medium).toBe(0.89);
    expect(JKK_RATES.high).toBe(1.27);
    expect(JKK_RATES.very_high).toBe(1.74);
  });

  it('strictly increases across the risk spectrum', () => {
    expect(JKK_RATES.very_low).toBeLessThan(JKK_RATES.low);
    expect(JKK_RATES.low).toBeLessThan(JKK_RATES.medium);
    expect(JKK_RATES.medium).toBeLessThan(JKK_RATES.high);
    expect(JKK_RATES.high).toBeLessThan(JKK_RATES.very_high);
  });
});
