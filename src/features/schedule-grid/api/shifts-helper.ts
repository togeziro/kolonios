/**
 * Small query helper used by the cell popover (ticket 02) to populate
 * its Shift dropdown. Returns the set of shifts that have a
 * `shift_weekday_rules` row for the requested day-of-week (0=Sun..6=Sat),
 * along with the policy columns needed for the option label
 * (`late_tolerance_minutes`, `absence_cutoff_minutes`).
 */

import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { mapDbError } from '@/lib/errors';
import { db } from '@/lib/db';
import { shifts, shiftWeekdayRules } from '@/lib/db/schema/attendance';

const eligibleShiftsSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6)
});

export type EligibleShift = {
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
};

export const listEligibleShiftsForDayFn = createServerFn({ method: 'GET' })
  .validator(eligibleShiftsSchema)
  .handler(
    async ({
      data
    }): Promise<{ success: true; shifts: EligibleShift[] } | { success: false; error: string }> => {
      await requirePermission('attendance_admin', 'edit');
      try {
        const ruleRows = await db
          .select({
            shiftId: shiftWeekdayRules.shift_id,
            startTime: shiftWeekdayRules.start_time,
            endTime: shiftWeekdayRules.end_time,
            isWorkingDay: shiftWeekdayRules.is_working_day
          })
          .from(shiftWeekdayRules)
          .where(
            and(
              eq(shiftWeekdayRules.day_of_week, data.dayOfWeek),
              eq(shiftWeekdayRules.is_working_day, true)
            )
          );

        if (ruleRows.length === 0) {
          return { success: true, shifts: [] };
        }

        const shiftIds = Array.from(new Set(ruleRows.map((r) => r.shiftId)));
        const [shiftRows, policyRows] = await Promise.all([
          db
            .select({
              id: shifts.id,
              name: shifts.name,
              startTime: shifts.start_time,
              endTime: shifts.end_time
            })
            .from(shifts)
            .where(inArray(shifts.id, shiftIds)),
          db
            .select({
              id: shifts.id,
              late_tolerance_minutes: shifts.late_tolerance_minutes,
              absence_cutoff_minutes: shifts.absence_cutoff_minutes
            })
            .from(shifts)
            .where(inArray(shifts.id, shiftIds))
        ]);

        const policyById = new Map(policyRows.map((p) => [p.id, p]));
        const shiftById = new Map(shiftRows.map((s) => [s.id, s]));

        // Use the rule's start/end (per-day) but the shift's policy columns.
        const out: EligibleShift[] = [];
        for (const r of ruleRows) {
          const shift = shiftById.get(r.shiftId);
          const policy = policyById.get(r.shiftId);
          if (!shift || !policy) continue;
          out.push({
            shiftId: shift.id,
            shiftName: shift.name,
            startTime: r.startTime ?? shift.startTime,
            endTime: r.endTime ?? shift.endTime,
            lateToleranceMinutes: policy.late_tolerance_minutes ?? 0,
            absenceCutoffMinutes: policy.absence_cutoff_minutes ?? 0
          });
        }

        return { success: true, shifts: out };
      } catch (e) {
        mapDbError(e, 'scheduleGrid.listEligibleShiftsForDay');
        return { success: false, error: 'internal' };
      }
    }
  );
