// Pure achievement aggregates: streaks, monthly attendance stats, week dots,
// and completed-ticket badges. Every function takes its data (and the
// business date) as input — no DB, no clock — so each rule is unit-testable
// without fixtures.
export const STREAK_WINDOW_DAYS = 90;
export const FAST_FINISH_MINUTES = 30;
export const EARLY_CHECK_IN_TIME = '07:00';
export const NIGHT_OWL_CHECK_OUT_TIME = '20:00';

export type AttendanceDayRow = {
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  attendanceStatus: string;
};

export type CompletedTicketRow = {
  taskType: string;
  completedAt: Date | null;
  takenAt: Date | null;
};

export type AchievementData = {
  currentStreak: number;
  bestStreak: number;
  last7Days: { date: string; checkedIn: boolean }[];
  monthEarlyCheckIns: number;
  monthNightOwlCheckOuts: number;
  inspectionCompleted: number;
  totalCompleted: number;
  uniqueTaskTypes: string[];
  fastFinisherCount: number;
  weekTasksCompleted: number;
};

// --- Business-date helpers (YYYY-MM-DD, Monday-start weeks) ---

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateStrOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parse(bd: string): Date {
  const [y, m, d] = bd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return dateStrOf(new Date(y, m - 1, d + delta));
}

export function monthBounds(bd: string): { start: string; end: string } {
  const d = parse(bd);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { start: `${bd.slice(0, 7)}-01`, end: `${bd.slice(0, 7)}-${pad2(lastDay)}` };
}

export function weekStartOf(bd: string): string {
  const d = parse(bd);
  const day = d.getDay();
  return shiftDays(bd, -(day === 0 ? 6 : day - 1));
}

// --- Streaks ---
// Consecutive present/late days within the window ending today; the current
// streak survives when today is missing but yesterday closes a run.

export function computeStreakStats(
  rows: AttendanceDayRow[],
  today: string
): { currentStreak: number; bestStreak: number } {
  const todayDate = parse(today);
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = STREAK_WINDOW_DAYS - 1; i >= 0; i--) {
    const checkDate = new Date(todayDate);
    checkDate.setDate(checkDate.getDate() - i);
    const record = rows.find((r) => r.date === dateStrOf(checkDate));
    const isPresent =
      record && (record.attendanceStatus === 'present' || record.attendanceStatus === 'late');

    if (isPresent) {
      tempStreak++;
      if (i <= 1) currentStreak = tempStreak;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

  return { currentStreak, bestStreak };
}

// --- Monthly attendance stats ---

export function computeMonthlyAttendance(
  rows: AttendanceDayRow[],
  bounds: { start: string; end: string }
): { monthEarlyCheckIns: number; monthNightOwlCheckOuts: number } {
  const monthRecords = rows.filter((r) => r.date >= bounds.start && r.date <= bounds.end);
  const monthEarlyCheckIns = monthRecords.filter(
    (r) => r.checkInTime && r.checkInTime < EARLY_CHECK_IN_TIME
  ).length;
  const monthNightOwlCheckOuts = monthRecords.filter(
    (r) => r.checkOutTime && r.checkOutTime > NIGHT_OWL_CHECK_OUT_TIME
  ).length;
  return { monthEarlyCheckIns, monthNightOwlCheckOuts };
}

// --- Week dots (last 7 days including today) ---

export function computeWeekDots(
  rows: AttendanceDayRow[],
  today: string
): { date: string; checkedIn: boolean }[] {
  const last7Days: { date: string; checkedIn: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = shiftDays(today, -i);
    const record = rows.find((r) => r.date === date);
    last7Days.push({ date, checkedIn: !!(record && record.attendanceStatus !== 'absent') });
  }
  return last7Days;
}

// --- Completed-ticket badges ---

export function computeTicketAchievements(
  tickets: CompletedTicketRow[],
  deps: {
    weekStart: string;
    toBusinessDate: (d: Date) => string;
  }
): Pick<
  AchievementData,
  | 'inspectionCompleted'
  | 'totalCompleted'
  | 'uniqueTaskTypes'
  | 'fastFinisherCount'
  | 'weekTasksCompleted'
> {
  const inspectionCompleted = tickets.filter((t) => t.taskType === 'inspection').length;
  const uniqueTaskTypes = [...new Set(tickets.map((t) => t.taskType).filter(Boolean))];
  const fastFinisherCount = tickets.filter((t) => {
    if (!t.takenAt || !t.completedAt) return false;
    const elapsed = (t.completedAt.getTime() - t.takenAt.getTime()) / (1000 * 60);
    return elapsed >= 0 && elapsed < FAST_FINISH_MINUTES;
  }).length;
  const weekTasksCompleted = tickets.filter(
    (t) => t.completedAt && deps.toBusinessDate(t.completedAt) >= deps.weekStart
  ).length;

  return {
    inspectionCompleted,
    totalCompleted: tickets.length,
    uniqueTaskTypes,
    fastFinisherCount,
    weekTasksCompleted
  };
}
