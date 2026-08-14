import { db } from '@/lib/db';
import { employeeShifts } from '@/lib/db/schema/attendance';
import { tickets } from '@/lib/db/schema/tickets';
import { businessDateInTimeZone } from '@/lib/dates';
import { and, eq, gte, lte } from 'drizzle-orm';

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getMonthStart(bd: string): string {
  return `${bd.slice(0, 7)}-01`;
}

function getMonthEnd(bd: string): string {
  const [y, m] = bd.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${bd.slice(0, 7)}-${pad2(lastDay)}`;
}

function getWeekStart(bd: string): string {
  const [y, m, d] = bd.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const diff = d - day + (day === 0 ? -6 : 1);
  const monday = new Date(y, m - 1, diff);
  monday.setHours(0, 0, 0, 0);
  return dateStr(monday);
}

export async function getAchievementData(userId: string): Promise<AchievementData> {
  const businessDate = businessDateInTimeZone(new Date());
  const today = businessDate;
  const monthStart = getMonthStart(businessDate);
  const monthEnd = getMonthEnd(businessDate);
  const weekStart = getWeekStart(businessDate);

  // Attendance records for last 90 days (streak + monthly stats + week dots)
  const [by, bm, bd] = businessDate.split('-').map(Number);
  const todayDate = new Date(by, bm - 1, bd);
  const ninetyDaysAgo = new Date(by, bm - 1, bd);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = dateStr(ninetyDaysAgo);

  const attendanceRows = await db
    .select({
      date: employeeShifts.date,
      checkInTime: employeeShifts.check_in_time,
      checkOutTime: employeeShifts.check_out_time,
      attendanceStatus: employeeShifts.attendance_status
    })
    .from(employeeShifts)
    .where(
      and(
        eq(employeeShifts.user_id, userId),
        gte(employeeShifts.date, ninetyDaysAgoStr),
        lte(employeeShifts.date, today)
      )
    )
    .orderBy(employeeShifts.date);

  // Compute streak: consecutive present/late days ending today or yesterday
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = 89; i >= 0; i--) {
    const checkDate = new Date(todayDate);
    checkDate.setDate(checkDate.getDate() - i);
    const record = attendanceRows.find((r) => r.date === dateStr(checkDate));
    const isPresent =
      record && (record.attendanceStatus === 'present' || record.attendanceStatus === 'late');

    if (isPresent) {
      tempStreak++;
      if (i <= 1) currentStreak = tempStreak; // streak includes today or yesterday
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 0;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

  // Monthly stats
  const monthRecords = attendanceRows.filter((r) => r.date >= monthStart && r.date <= monthEnd);
  const monthEarlyCheckIns = monthRecords.filter(
    (r) => r.checkInTime && r.checkInTime < '07:00'
  ).length;
  const monthNightOwlCheckOuts = monthRecords.filter(
    (r) => r.checkOutTime && r.checkOutTime > '20:00'
  ).length;

  // Last 7 days for week dots
  const last7Days: { date: string; checkedIn: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const date = dateStr(d);
    const record = attendanceRows.find((r) => r.date === date);
    last7Days.push({ date, checkedIn: !!(record && record.attendanceStatus !== 'absent') });
  }

  // Completed tickets
  const completedTickets = await db
    .select({
      taskType: tickets.task_type,
      completedAt: tickets.completed_at,
      takenAt: tickets.taken_at
    })
    .from(tickets)
    .where(and(eq(tickets.assigned_to, userId), eq(tickets.status, 'completed')));

  const inspectionCompleted = completedTickets.filter((t) => t.taskType === 'inspection').length;
  const totalCompleted = completedTickets.length;
  const uniqueTaskTypes = [
    ...new Set(completedTickets.map((t) => t.taskType).filter(Boolean))
  ] as string[];

  // Fast finisher: tickets completed in <30 min
  const fastFinisherCount = completedTickets.filter((t) => {
    if (!t.takenAt || !t.completedAt) return false;
    const elapsed = (t.completedAt.getTime() - t.takenAt.getTime()) / (1000 * 60);
    return elapsed < 30;
  }).length;

  // Weekly tasks completed (business-date comparison against the business Monday)
  const weekTasksCompleted = completedTickets.filter(
    (t) => t.completedAt && businessDateInTimeZone(t.completedAt) >= weekStart
  ).length;

  return {
    currentStreak,
    bestStreak,
    last7Days,
    monthEarlyCheckIns,
    monthNightOwlCheckOuts,
    inspectionCompleted,
    totalCompleted,
    uniqueTaskTypes,
    fastFinisherCount,
    weekTasksCompleted
  };
}
