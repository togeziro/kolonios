import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './build-month-grid';
import type { ScheduleMonthData } from '@/lib/db/attendance';

function monthData(overrides: Partial<ScheduleMonthData> = {}): ScheduleMonthData {
  return {
    assignment: {
      shiftId: 1,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      shiftName: 'Morning'
    },
    weekdayRules: [
      {
        dayOfWeek: 1,
        isWorkingDay: true,
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 10,
        absenceCutoffMinutes: 120
      },
      {
        dayOfWeek: 6,
        isWorkingDay: false,
        startTime: null,
        endTime: null,
        lateToleranceMinutes: 0,
        absenceCutoffMinutes: 120
      }
    ],
    overrides: [],
    dayOffs: [],
    holidays: [],
    ...overrides
  };
}

describe('buildMonthGrid', () => {
  it('builds every day of August 2026 (31 cells), Monday marked working', () => {
    const cells = buildMonthGrid('2026-08', monthData());
    expect(cells).toHaveLength(31);
    expect(cells[0].date).toBe('2026-08-01');
    expect(cells[0].dayOfWeek).toBe(6); // Aug 1 2026 is a Saturday
    const monday = cells.find((c) => c.date === '2026-08-03');
    expect(monday?.isWorkingDay).toBe(true);
    expect(monday?.startTime).toBe('08:00');
    const saturday = cells.find((c) => c.date === '2026-08-01');
    expect(saturday?.isWorkingDay).toBe(false);
  });

  it('handles February of a non-leap year (28 cells)', () => {
    const cells = buildMonthGrid('2026-02', monthData());
    expect(cells).toHaveLength(28);
  });

  it('marks day offs', () => {
    const cells = buildMonthGrid('2026-08', monthData({ dayOffs: ['2026-08-03'] }));
    const monday = cells.find((c) => c.date === '2026-08-03');
    expect(monday?.isDayOff).toBe(true);
    expect(monday?.isWorkingDay).toBe(false);
  });

  it('marks holidays with their name', () => {
    const cells = buildMonthGrid(
      '2026-08',
      monthData({ holidays: [{ date: '2026-08-17', name: 'Independence Day', isRecurring: false }] })
    );
    const holiday = cells.find((c) => c.date === '2026-08-17');
    expect(holiday?.isHoliday).toBe(true);
    expect(holiday?.holidayName).toBe('Independence Day');
  });

  it('returns all non-working cells when no assignment exists', () => {
    const cells = buildMonthGrid('2026-08', monthData({ assignment: null, weekdayRules: [] }));
    expect(cells.every((c) => !c.isWorkingDay)).toBe(true);
  });

  it('keeps the day resolvable when a date override targets the same weekday rule', () => {
    const cells = buildMonthGrid(
      '2026-08',
      monthData({ overrides: [{ date: '2026-08-03', shiftId: 2 }] })
    );
    const monday = cells.find((c) => c.date === '2026-08-03');
    // resolveEffectiveSchedule picks the weekday rule by dayOfWeek (first match),
    // so hours come from the single Monday rule regardless of the override.
    expect(monday?.isWorkingDay).toBe(true);
    expect(monday?.startTime).toBe('08:00');
  });
});
