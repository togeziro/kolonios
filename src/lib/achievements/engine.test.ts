import { describe, expect, it } from 'vitest';
import {
  FAST_FINISH_MINUTES,
  computeStreakStats,
  computeMonthlyAttendance,
  computeWeekDots,
  computeTicketAchievements,
  monthBounds,
  weekStartOf,
  shiftDays,
  dateStrOf,
  type AttendanceDayRow,
  type CompletedTicketRow
} from './engine';

const TODAY = '2026-08-23'; // a Sunday

function day(overrides: Partial<AttendanceDayRow> & { date: string }): AttendanceDayRow {
  return {
    checkInTime: null,
    checkOutTime: null,
    attendanceStatus: 'present',
    ...overrides
  };
}

function ticket(overrides: Partial<CompletedTicketRow> = {}): CompletedTicketRow {
  return { taskType: 'installation', completedAt: null, takenAt: null, ...overrides };
}

const identityBusinessDate = dateStrOf;

describe('date helpers', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(shiftDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('bounds the month of its business date', () => {
    expect(monthBounds('2026-08-23')).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(monthBounds('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2024-02-10')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('starts weeks on Monday, rolling back over weekends', () => {
    expect(weekStartOf('2026-08-23')).toBe('2026-08-17'); // Sunday -> previous Monday
    expect(weekStartOf('2026-08-24')).toBe('2026-08-24'); // Monday -> itself
    expect(weekStartOf('2026-08-30')).toBe('2026-08-24'); // next Sunday
  });
});

describe('computeStreakStats', () => {
  it('counts consecutive present days ending today', () => {
    const rows = [
      day({ date: '2026-08-21' }),
      day({ date: '2026-08-22' }),
      day({ date: '2026-08-23' })
    ];
    const { currentStreak, bestStreak } = computeStreakStats(rows, TODAY);
    expect(currentStreak).toBe(3);
    expect(bestStreak).toBe(3);
  });

  it('counts late as present for streak purposes', () => {
    const rows = [
      day({ date: '2026-08-22', attendanceStatus: 'late' }),
      day({ date: '2026-08-23' })
    ];
    expect(computeStreakStats(rows, TODAY).currentStreak).toBe(2);
  });

  it('keeps the current streak when today is missing but yesterday closes a run', () => {
    const rows = [
      day({ date: '2026-08-19' }),
      day({ date: '2026-08-20' }),
      day({ date: '2026-08-21' }),
      day({ date: '2026-08-22' })
    ];
    const { currentStreak, bestStreak } = computeStreakStats(rows, TODAY);
    expect(currentStreak).toBe(4);
    expect(bestStreak).toBe(4);
  });

  it('reports zero current streak when neither today nor yesterday is present', () => {
    const rows = [day({ date: '2026-08-20' })];
    const stats = computeStreakStats(rows, TODAY);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(1);
  });

  it('keeps the longer historical run as best streak', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => day({ date: shiftDays(TODAY, -(10 - i)) })),
      day({ date: shiftDays(TODAY, -2) }),
      day({ date: shiftDays(TODAY, -1), attendanceStatus: 'late' })
    ];
    const { currentStreak, bestStreak } = computeStreakStats(rows, TODAY);
    expect(currentStreak).toBe(2);
    expect(bestStreak).toBe(5);
  });

  it('ignores absences inside runs', () => {
    const rows = [
      day({ date: '2026-08-21' }),
      day({ date: '2026-08-22', attendanceStatus: 'absent' }),
      day({ date: '2026-08-23' })
    ];
    expect(computeStreakStats(rows, TODAY).currentStreak).toBe(1);
  });

  it('returns zeros with no records', () => {
    expect(computeStreakStats([], TODAY)).toEqual({ currentStreak: 0, bestStreak: 0 });
  });
});

describe('computeMonthlyAttendance', () => {
  it('counts early check-ins before 07:00 within bounds only', () => {
    const rows = [
      day({ date: '2026-08-01', checkInTime: '06:45' }),
      day({ date: '2026-08-02', checkInTime: '06:50' }),
      day({ date: '2026-08-03', checkInTime: '08:00', attendanceStatus: 'late' }),
      day({ date: '2026-07-31', checkInTime: '05:00' })
    ];
    const { monthEarlyCheckIns } = computeMonthlyAttendance(rows, {
      start: '2026-08-01',
      end: '2026-08-31'
    });
    expect(monthEarlyCheckIns).toBe(2);
  });

  it('counts night-owl check-outs after 20:00', () => {
    const rows = [
      day({ date: '2026-08-01', checkOutTime: '20:00' }),
      day({ date: '2026-08-02', checkOutTime: '20:30' }),
      day({ date: '2026-08-03', checkOutTime: '21:00' })
    ];
    const { monthNightOwlCheckOuts } = computeMonthlyAttendance(rows, {
      start: '2026-08-01',
      end: '2026-08-31'
    });
    expect(monthNightOwlCheckOuts).toBe(2);
  });
});

describe('computeWeekDots', () => {
  it('returns seven days ending today; absent counts as not checked in', () => {
    const rows = [
      day({ date: '2026-08-17' }),
      day({ date: '2026-08-18', attendanceStatus: 'absent' }),
      day({ date: '2026-08-23', attendanceStatus: 'late' })
    ];
    const dots = computeWeekDots(rows, TODAY);
    expect(dots).toHaveLength(7);
    expect(dots[0]).toEqual({ date: '2026-08-17', checkedIn: true });
    expect(dots[1]).toEqual({ date: '2026-08-18', checkedIn: false });
    expect(dots[6]).toEqual({ date: '2026-08-23', checkedIn: true });
  });
});

describe('computeTicketAchievements', () => {
  const deps = { weekStart: '2026-08-17', toBusinessDate: identityBusinessDate };

  it('aggregates totals, inspections, and unique task types', () => {
    const tickets = [
      ticket({ taskType: 'inspection' }),
      ticket({ taskType: 'inspection' }),
      ticket({ taskType: 'maintenance' })
    ];
    const result = computeTicketAchievements(tickets, deps);
    expect(result.inspectionCompleted).toBe(2);
    expect(result.totalCompleted).toBe(3);
    expect(result.uniqueTaskTypes.sort()).toEqual(['inspection', 'maintenance']);
  });

  it('flags fast finishers strictly under 30 minutes and never negative elapsed', () => {
    const taken = new Date('2026-08-20T10:00:00');
    const tickets = [
      ticket({ takenAt: taken, completedAt: new Date('2026-08-20T10:29:00') }),
      ticket({ takenAt: taken, completedAt: new Date('2026-08-20T10:30:00') }),
      ticket({
        takenAt: new Date('2026-08-20T11:00:00'),
        completedAt: new Date('2026-08-20T10:00:00')
      }),
      ticket()
    ];
    expect(computeTicketAchievements(tickets, deps).fastFinisherCount).toBe(1);
    expect(FAST_FINISH_MINUTES).toBe(30);
  });

  it('counts completions from this week via the business-date conversion', () => {
    const tickets = [
      ticket({ completedAt: new Date('2026-08-18T12:00:00') }),
      ticket({ completedAt: new Date('2026-08-16T12:00:00') }),
      ticket()
    ];
    expect(computeTicketAchievements(tickets, deps).weekTasksCompleted).toBe(1);
  });
});
