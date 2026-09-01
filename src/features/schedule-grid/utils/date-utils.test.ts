import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  formatWeekRangeLabel,
  monthOfDate,
  startOfWeek,
  weekDays
} from './date-utils';

describe('schedule-grid date utils', () => {
  it('addDays moves YYYY-MM-DD forward and backward without DST drift', () => {
    expect(addDays('2026-08-03', 7)).toBe('2026-08-10');
    expect(addDays('2026-08-03', -7)).toBe('2026-07-27');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('dayOfWeek matches the engine convention (0=Sun..6=Sat)', () => {
    expect(dayOfWeek('2026-08-03')).toBe(1); // Monday
    expect(dayOfWeek('2026-08-09')).toBe(0); // Sunday
    expect(dayOfWeek('2026-08-08')).toBe(6); // Saturday
  });

  it('startOfWeek anchors Monday and Sunday preferences', () => {
    expect(startOfWeek('2026-08-05', 'monday')).toBe('2026-08-03');
    expect(startOfWeek('2026-08-05', 'sunday')).toBe('2026-08-02');
  });

  it('weekDays returns exactly seven consecutive dates starting at weekStart', () => {
    expect(weekDays('2026-08-03')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09'
    ]);
  });

  it('monthOfDate extracts YYYY-MM', () => {
    expect(monthOfDate('2026-08-03')).toBe('2026-08');
  });

  it('formatWeekRangeLabel collapses the same-month range', () => {
    expect(formatWeekRangeLabel('2026-08-03', '2026-08-09')).toBe('Aug 3 – 9, 2026');
  });

  it('formatWeekRangeLabel keeps both month names when crossing a month boundary', () => {
    expect(formatWeekRangeLabel('2026-08-28', '2026-09-03')).toBe('Aug 28 – Sep 3, 2026');
  });
});
