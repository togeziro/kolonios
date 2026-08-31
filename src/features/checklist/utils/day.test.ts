import { describe, expect, it } from 'vitest';
import { resolveChecklistDay, type ChecklistDayInput } from './day';

function base(overrides: Partial<ChecklistDayInput> = {}): ChecklistDayInput {
  return {
    date: '2026-08-12', // Wednesday
    assignment: { shiftId: 1, effectiveFrom: '2026-01-01', effectiveTo: null },
    weekdayRules: [{ dayOfWeek: 3, isWorkingDay: true, startTime: '08:00', endTime: '17:00' }],
    shiftPolicies: [{ shiftId: 1, lateToleranceMinutes: 10, absenceCutoffMinutes: 120 }],
    overrides: [],
    dayOffs: [],
    holidays: [],
    ...overrides
  };
}

describe('resolveChecklistDay', () => {
  it('resolves a working day with its shift snapshot', () => {
    const res = resolveChecklistDay(base());
    expect(res.status).toBe('working');
    expect(res.schedule).toEqual({ shiftId: 1, startTime: '08:00', endTime: '17:00' });
  });

  it('day off wins over working rules', () => {
    const res = resolveChecklistDay(base({ dayOffs: ['2026-08-12'] }));
    expect(res.status).toBe('day_off');
    expect(res.schedule).toBeNull();
  });

  it('holiday skips the checklist even on a working day', () => {
    const res = resolveChecklistDay(
      base({ holidays: [{ date: '2026-08-12', name: 'Independence Day', isRecurring: false }] })
    );
    expect(res.status).toBe('holiday');
    expect(res.schedule).toBeNull();
  });

  it('recurring holiday matches by month-day across years', () => {
    const res = resolveChecklistDay(
      base({
        date: '2026-08-17',
        holidays: [{ date: '2025-08-17', name: 'Independence Day', isRecurring: true }]
      })
    );
    expect(res.status).toBe('holiday');
  });

  it('a non-recurring holiday from another year does not match', () => {
    const res = resolveChecklistDay(
      base({
        holidays: [{ date: '2025-08-12', name: 'One-off last year', isRecurring: false }]
      })
    );
    expect(res.status).toBe('working');
  });

  it('no assignment means no checklist', () => {
    const res = resolveChecklistDay(base({ assignment: null }));
    expect(res.status).toBe('no_schedule');
    expect(res.schedule).toBeNull();
  });

  it('non-working weekday means no checklist', () => {
    const res = resolveChecklistDay(base({ date: '2026-08-16' })); // Sunday
    expect(res.status).toBe('no_schedule');
  });
});
