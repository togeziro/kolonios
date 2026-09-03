import { db } from '@/lib/db';
import { employeeShifts } from '@/lib/db/schema/attendance';
import { tickets } from '@/lib/db/schema/tickets';
import { businessDateInTimeZone } from '@/lib/dates';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  computeStreakStats,
  computeMonthlyAttendance,
  computeWeekDots,
  computeTicketAchievements,
  monthBounds,
  weekStartOf,
  shiftDays,
  type AchievementData,
  type CompletedTicketRow
} from '@/lib/achievements/engine';

export type { AchievementData };

export async function getAchievementData(userId: string): Promise<AchievementData> {
  const today = businessDateInTimeZone(new Date());
  const bounds = monthBounds(today);
  const weekStart = weekStartOf(today);
  const ninetyDaysAgo = shiftDays(today, -90);

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
        gte(employeeShifts.date, ninetyDaysAgo),
        lte(employeeShifts.date, today)
      )
    )
    .orderBy(employeeShifts.date);

  const completedTickets = await db
    .select({
      taskType: tickets.task_type,
      completedAt: tickets.completed_at,
      firstTakenAt: tickets.first_taken_at,
      takenAt: tickets.taken_at
    })
    .from(tickets)
    .where(and(eq(tickets.assigned_to, userId), eq(tickets.status, 'completed')));

  // Total ticket duration = first claim → completion. `first_taken_at` is
  // preserved across relay claims (taken_at resets per holder session), so the
  // fast-finish metric measures the whole job, not just the last leg.
  const resolved: CompletedTicketRow[] = completedTickets.map((t) => ({
    taskType: t.taskType,
    completedAt: t.completedAt,
    takenAt: t.firstTakenAt ?? t.takenAt
  }));

  return {
    ...computeStreakStats(attendanceRows, today),
    last7Days: computeWeekDots(attendanceRows, today),
    ...computeMonthlyAttendance(attendanceRows, bounds),
    ...computeTicketAchievements(resolved, {
      weekStart,
      toBusinessDate: businessDateInTimeZone
    })
  };
}
