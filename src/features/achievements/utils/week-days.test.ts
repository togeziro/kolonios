import { describe, expect, it } from 'vitest';
import { buildWeekDays } from './week-days';

describe('buildWeekDays', () => {
  it('builds a Monday-aligned 7-cell week containing the business date', () => {
    const days = buildWeekDays([], '2026-08-15');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16'
    ]);
    expect(days[5].isToday).toBe(true);
  });

  it('starts the week on Monday when the business date is a Sunday', () => {
    const days = buildWeekDays([], '2026-08-16');
    expect(days[0].date).toBe('2026-08-10');
    expect(days[6].date).toBe('2026-08-16');
    expect(days[6].isToday).toBe(true);
    expect(days[5].isToday).toBe(false);
  });

  it('maps checkedIn from matching last7Days entries by date, not by index', () => {
    // Rolling 7-day window ends Saturday, one day before the Monday-aligned week's Sunday
    const last7Days = [
      { date: '2026-08-09', checkedIn: true },
      { date: '2026-08-10', checkedIn: true },
      { date: '2026-08-11', checkedIn: true },
      { date: '2026-08-12', checkedIn: true },
      { date: '2026-08-13', checkedIn: true },
      { date: '2026-08-14', checkedIn: true },
      { date: '2026-08-15', checkedIn: true }
    ];
    const days = buildWeekDays(last7Days, '2026-08-15');
    expect(days.map((d) => d.checkedIn)).toEqual([true, true, true, true, true, true, false]);
  });

  it('defaults to checkedIn false when last7Days has no entry for a day', () => {
    const days = buildWeekDays([{ date: '2026-08-12', checkedIn: true }], '2026-08-15');
    expect(days.map((d) => d.checkedIn)).toEqual([false, false, true, false, false, false, false]);
  });
});
