import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './build-month-grid';
import type { ScheduleMonthData } from '@/lib/db/attendance';

function monthData(overrides: Partial<ScheduleMonthData> = {}): ScheduleMonthData {
  return {
    assignments: [
      {
        shiftId: 1,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        shiftName: 'Morning'
      }
    ],
    weekdayRules: [
      {
        shiftId: 1,
        dayOfWeek: 1,
        isWorkingDay: true,
        startTime: '08:00',
        endTime: '17:00'
      },
      {
        shiftId: 1,
        dayOfWeek: 6,
        isWorkingDay: false,
        startTime: null,
        endTime: null
      }
    ],
    shiftPolicies: [{ shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }],
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
      monthData({
        holidays: [{ date: '2026-08-17', name: 'Independence Day', isRecurring: false }]
      })
    );
    const holiday = cells.find((c) => c.date === '2026-08-17');
    expect(holiday?.isHoliday).toBe(true);
    expect(holiday?.holidayName).toBe('Independence Day');
  });

  it('returns all non-working cells when no assignment exists', () => {
    const cells = buildMonthGrid('2026-08', monthData({ assignments: [], weekdayRules: [] }));
    expect(cells.every((c) => !c.isWorkingDay)).toBe(true);
  });

  it('keeps the day resolvable when a date override targets the same weekday rule', () => {
    const cells = buildMonthGrid(
      '2026-08',
      monthData({
        overrides: [{ date: '2026-08-03', shiftId: 2 }],
        shiftPolicies: [
          { shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 },
          { shiftId: 2, lateToleranceMinutes: 5, absenceCutoffMinutes: 60 }
        ]
      })
    );
    const monday = cells.find((c) => c.date === '2026-08-03');
    // resolveEffectiveSchedule picks the weekday rule by dayOfWeek (first match),
    // so hours come from the single Monday rule regardless of the override.
    expect(monday?.isWorkingDay).toBe(true);
    expect(monday?.startTime).toBe('08:00');
    // Tolerance comes from the override shift's policy (ADR-0004)
    expect(monday?.lateToleranceMinutes).toBe(5);
  });

  it('falls back to zero tolerance when the override shift has no policy', () => {
    const cells = buildMonthGrid(
      '2026-08',
      monthData({ overrides: [{ date: '2026-08-03', shiftId: 2 }] })
    );
    const monday = cells.find((c) => c.date === '2026-08-03');
    expect(monday?.lateToleranceMinutes).toBe(0);
  });

  it('dates before assignment.effectiveFrom resolve to no-schedule (green dot gone)', () => {
    const cells = buildMonthGrid('2026-09', {
      assignments: [
        {
          shiftId: 1,
          effectiveFrom: '2026-09-14',
          effectiveTo: '2026-12-31',
          shiftName: 'S1'
        }
      ],
      weekdayRules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        shiftId: 1,
        dayOfWeek,
        isWorkingDay: true,
        startTime: '08:00',
        endTime: '17:00'
      })),
      shiftPolicies: [{ shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }],
      overrides: [],
      dayOffs: [],
      holidays: []
    });
    // Sept 1 (Tue, before effective_from) → not working, no shift times
    const before = cells.find((c) => c.date === '2026-09-01')!;
    expect(before.isWorkingDay).toBe(false);
    expect(before.startTime).toBeNull();
    expect(before.endTime).toBeNull();
    // Sept 14 (Mon) onward → working
    const on = cells.find((c) => c.date === '2026-09-14')!;
    expect(on.isWorkingDay).toBe(true);
    expect(on.startTime).toBe('08:00');
    expect(on.endTime).toBe('17:00');
    const after = cells.find((c) => c.date === '2026-09-15')!;
    expect(after.isWorkingDay).toBe(true);
  });

  it('dates after assignment.effectiveTo resolve to no-schedule', () => {
    const cells = buildMonthGrid('2026-09', {
      assignments: [
        {
          shiftId: 1,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-09-21',
          shiftName: 'S1'
        }
      ],
      weekdayRules: [1, 2].map((dayOfWeek) => ({
        shiftId: 1,
        dayOfWeek,
        isWorkingDay: true,
        startTime: '08:00',
        endTime: '17:00'
      })),
      shiftPolicies: [{ shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }],
      overrides: [],
      dayOffs: [],
      holidays: []
    });
    // Sept 21 (Mon) is the last in-range day → working
    const lastInRange = cells.find((c) => c.date === '2026-09-21')!;
    expect(lastInRange.isWorkingDay).toBe(true);
    // Sept 22 (Tue) is one day past effective_to → not working
    const outOfRange = cells.find((c) => c.date === '2026-09-22')!;
    expect(outOfRange.isWorkingDay).toBe(false);
    expect(outOfRange.startTime).toBeNull();
  });

  it('resolves each day against its own range when a month has several assignments (dhani case)', () => {
    const cells = buildMonthGrid('2026-09', {
      assignments: [
        {
          shiftId: 1,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-09-05',
          shiftName: 'Morning'
        },
        {
          shiftId: 1,
          effectiveFrom: '2026-09-14',
          effectiveTo: '2026-09-16',
          shiftName: 'Morning'
        },
        { shiftId: 1, effectiveFrom: '2026-09-17', effectiveTo: '2026-09-18', shiftName: 'Morning' }
      ],
      weekdayRules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        shiftId: 1,
        dayOfWeek,
        isWorkingDay: true,
        startTime: '08:00',
        endTime: '17:00'
      })),
      shiftPolicies: [{ shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }],
      overrides: [],
      dayOffs: [],
      holidays: []
    });
    const on = (date: string) => cells.find((c) => c.date === date)!;

    // Every range in the month still resolves — regression: a single
    // "latest assignment" pick blanked out the earlier ranges.
    expect(on('2026-09-01').isWorkingDay).toBe(true);
    expect(on('2026-09-01').shiftName).toBe('Morning');
    expect(on('2026-09-03').isWorkingDay).toBe(true);
    expect(on('2026-09-14').isWorkingDay).toBe(true);
    expect(on('2026-09-16').isWorkingDay).toBe(true);
    expect(on('2026-09-18').isWorkingDay).toBe(true);

    // Days outside every range stay non-working.
    expect(on('2026-09-10').isWorkingDay).toBe(false);
    expect(on('2026-09-21').isWorkingDay).toBe(false);
    expect(on('2026-09-10').shiftName).toBeNull();
  });
});
