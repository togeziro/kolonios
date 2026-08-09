import { describe, expect, it } from 'vitest';
import { dateFnsLocale, formatCurrency, formatDate, formatLongDate } from './format';

describe('formatDate', () => {
  it('returns an empty string for falsy input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null as unknown as undefined)).toBe('');
  });

  it('defaults to compact dd/MM/yyyy in id-ID', () => {
    expect(formatDate(new Date(2026, 6, 31), undefined, 'id-ID')).toBe('31/07/2026');
  });

  it('honors custom options', () => {
    expect(
      formatDate(
        new Date(2026, 6, 31),
        { month: 'short', day: '2-digit', year: '2-digit' },
        'id-ID'
      )
    ).toBe('31 Jul 26');
  });

  it('formats en-US with MM/dd/yyyy ordering', () => {
    expect(formatDate(new Date(2026, 6, 31), undefined, 'en-US')).toBe('07/31/2026');
  });

  it('returns an empty string when the date is invalid', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('formatLongDate', () => {
  it('formats Indonesian long date', () => {
    expect(formatLongDate(new Date(2026, 6, 31), 'id-ID')).toBe('31 Juli 2026');
  });

  it('formats English long date', () => {
    expect(formatLongDate(new Date(2026, 6, 31), 'en-US')).toBe('July 31, 2026');
  });
});

describe('formatCurrency', () => {
  it('formats IDR with Indonesian locale', () => {
    expect(formatCurrency(1000000, 'id-ID')).toBe('Rp\u00A01.000.000,00');
  });

  it('formats IDR with English locale', () => {
    expect(formatCurrency(1000000, 'en-US')).toBe('IDR\u00A01,000,000.00');
  });

  it('keeps two decimals for fractional amounts', () => {
    expect(formatCurrency(1234.5, 'id-ID')).toBe('Rp\u00A01.234,50');
  });
});

describe('dateFnsLocale', () => {
  it('maps id-ID to the Indonesian date-fns locale', () => {
    expect(dateFnsLocale('id-ID').code).toBe('id');
  });

  it('falls back to en-US for any other value', () => {
    expect(dateFnsLocale('fr-FR').code).toBe('en-US');
  });
});
