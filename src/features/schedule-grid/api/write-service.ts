/**
 * Write-side server functions for the admin schedule grid (ticket 02).
 *
 * Mirrors the per-cell write surface that the popover drives:
 *  - `setCellShiftFn`     — replace the existing `date_overrides` row for
 *                           (user, date) with one pointing at `shiftId`.
 *                           Also deletes any `day_offs` row for the same
 *                           date — this is the orphan-prevention guard
 *                           (see "Orphan Day-Off risk" in the spec). The
 *                           popover's conflict UX already blocks the
 *                           "day_off → shift" path with a "Clear Day Off"
 *                           confirmation; this DELETE is a defensive
 *                           server-side mirror in case a future code path
 *                           or external write creates a masked orphan.
 *  - `setCellDayOffFn`    — delete any `date_overrides` row for (user, date)
 *                           then insert a `day_offs` row (with optional
 *                           reason from the popover input). Idempotent.
 *                           The date_overrides DELETE is the symmetric
 *                           orphan guard.
 *  - `clearCellFn`        — delete both `date_overrides` and `day_offs`
 *                           rows for (user, date).
 *  - `applyToWholeWeekFn` — iterate 7 dates starting at `weekStart`; for
 *                           each date either call `setCellShiftFn` or
 *                           `setCellDayOffFn`. Per-day failures are
 *                           captured into `partialFailures` rather than
 *                           aborting the whole batch. `WEEKEND_DAYS = [6, 0]`
 *                           is the source of truth for "weekend"; when
 *                           `includeWeekend === false` those days are
 *                           skipped regardless of week-start (Mon vs Sun).
 *
 * All four fns follow the `src/lib/db/attendance.ts` tuple convention:
 *   - return `{ success: true, ...payload }` on the happy path
 *   - return `{ success: false, error }` on failure (errors folded via
 *     `mapDbError`; never throw `DomainError` out of the server fn).
 * Each write runs in its own DB transaction (DELETE-then-INSERT) so the
 * `date_overrides_user_date_unique` / `day_offs_user_date_unique` unique
 * constraints cannot fire.
 */

import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { db } from '@/lib/db';
import { getHolidaysInRange } from '@/lib/db/attendance';
import {
  dateOverrides,
  dayOffs,
  scheduleAssignments,
  shifts,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import {
  resolveEffectiveSchedule,
  type DateOverride as EngineDateOverride,
  type ScheduleAssignment as EngineAssignment,
  type ShiftPolicy,
  type WeekdayScheduleRule
} from '@/lib/attendance/schedule';
import { WEEKEND_DAYS } from '../utils/constants';
import { addDays, dayOfWeek } from '../utils/date-utils';
import type { ScheduleGridCell } from './types';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const dayOffReasonSchema = z.string().trim().min(1).max(500).optional();

const setCellShiftSchema = z.object({
  userId: z.string().min(1),
  date: ymd,
  shiftId: z.number().int().positive()
});

const setCellDayOffSchema = z.object({
  userId: z.string().min(1),
  date: ymd,
  reason: dayOffReasonSchema
});

const clearCellSchema = z.object({
  userId: z.string().min(1),
  date: ymd
});

const applyToWholeWeekSchema = z.object({
  userId: z.string().min(1),
  weekStart: ymd,
  mode: z.enum(['shift', 'dayOff']),
  shiftId: z.number().int().positive().optional(),
  reason: dayOffReasonSchema,
  includeWeekend: z.boolean()
});

const ERROR_INTERNAL = 'internal' as const;
const ERROR_SHIFT_ID_REQUIRED = 'shiftIdRequired' as const;

/**
 * Tuple returned by every single-cell write fn. `cell` is the post-write
 * state of the affected cell, re-resolved via `resolveEffectiveSchedule`
 * so the popover can update its React Query cache directly.
 */
export type CellWriteResult =
  | {
      success: true;
      cell: ScheduleGridCell;
      affectedUserId: string;
      affectedDates: string[];
    }
  | {
      success: false;
      error: string;
    };

export type BulkResult =
  | {
      success: true;
      daysApplied: number;
      partialFailures: Array<{ date: string; error: string }>;
      affectedUserId: string;
      affectedDates: string[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * Re-resolve a single (user, date) cell after a write. Mirrors the
 * resolution logic in `getScheduleGridFn` so the cache update matches
 * what a fresh fetch would return.
 */
async function resolveSingleCell(input: {
  userId: string;
  date: string;
}): Promise<ScheduleGridCell> {
  const { userId, date } = input;

  // 1) Assignment row that covers this date (most recent first).
  const assignmentRows = await db
    .select()
    .from(scheduleAssignments)
    .where(
      and(
        eq(scheduleAssignments.user_id, userId),
        lte(scheduleAssignments.effective_from, date),
        or(
          sql`${scheduleAssignments.effective_to} IS NULL`,
          gte(scheduleAssignments.effective_to, date)
        )
      )
    )
    .orderBy(desc(scheduleAssignments.effective_from))
    .limit(1);

  const matching = assignmentRows[0] ?? null;
  const assignment: EngineAssignment | null = matching
    ? {
        userId: matching.user_id,
        shiftId: matching.shift_id,
        effectiveFrom: matching.effective_from,
        effectiveTo: matching.effective_to
      }
    : null;

  // 2) Override + day-off rows for this date.
  const [overrideRow] = await db
    .select()
    .from(dateOverrides)
    .where(and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, date)))
    .limit(1);

  const [dayOffRow] = await db
    .select()
    .from(dayOffs)
    .where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, date)))
    .limit(1);

  const overrideDates: EngineDateOverride[] = overrideRow
    ? [{ date: overrideRow.date, shiftId: overrideRow.shift_id }]
    : [];
  const dayOffDates = dayOffRow ? [dayOffRow.date] : [];

  // 3) Distinct shift ids needed: assignment shift + override shift.
  const shiftIds = new Set<number>();
  if (assignment) shiftIds.add(assignment.shiftId);
  if (overrideRow) shiftIds.add(overrideRow.shift_id);

  const weekdayRules: WeekdayScheduleRule[] = [];
  const policiesByShift = new Map<number, ShiftPolicy>();
  const shiftById = new Map<number, { id: number; name: string }>();

  if (shiftIds.size > 0) {
    const [ruleRows, shiftRows] = await Promise.all([
      db
        .select()
        .from(shiftWeekdayRules)
        .where(inArray(shiftWeekdayRules.shift_id, [...shiftIds])),
      db
        .select({
          id: shifts.id,
          name: shifts.name,
          late_tolerance_minutes: shifts.late_tolerance_minutes,
          absence_cutoff_minutes: shifts.absence_cutoff_minutes
        })
        .from(shifts)
        .where(inArray(shifts.id, [...shiftIds]))
    ]);
    for (const r of ruleRows) {
      weekdayRules.push({
        dayOfWeek: r.day_of_week,
        isWorkingDay: r.is_working_day ?? true,
        startTime: r.start_time,
        endTime: r.end_time
      });
    }
    for (const s of shiftRows) {
      shiftById.set(s.id, { id: s.id, name: s.name });
      policiesByShift.set(s.id, {
        shiftId: s.id,
        lateToleranceMinutes: s.late_tolerance_minutes,
        absenceCutoffMinutes: s.absence_cutoff_minutes
      });
    }
  }

  // 4) Holiday on this date (use the existing helper).
  const [holiday] = await getHolidaysInRange(date, date);

  // 5) Resolve via the shared engine.
  const resolved = resolveEffectiveSchedule({
    assignment,
    weekdayRules,
    shiftPolicies: [...policiesByShift.values()],
    dateOverrides: overrideDates,
    dayOffs: dayOffDates,
    date
  });

  const hasAssignment = assignment != null;
  const isDayOff = hasAssignment && dayOffDates.includes(date);

  // 6) Recompute `policyMissing` for parity with `getScheduleGridFn`.
  let policyMissing = false;
  if (hasAssignment && !isDayOff && resolved == null) {
    const effectiveShiftId = overrideRow?.shift_id ?? assignment!.shiftId;
    const rule = weekdayRules.find((r) => r.dayOfWeek === dayOfWeek(date));
    if (rule && rule.isWorkingDay) {
      policyMissing = policiesByShift.get(effectiveShiftId) == null;
    }
  }

  const holidayName = holiday?.name ?? null;

  return {
    date,
    shiftId: resolved?.shiftId ?? null,
    shiftName: resolved ? (shiftById.get(resolved.shiftId)?.name ?? null) : null,
    startTime: resolved?.startTime ?? null,
    endTime: resolved?.endTime ?? null,
    lateToleranceMinutes: resolved?.lateToleranceMinutes ?? null,
    absenceCutoffMinutes: resolved?.absenceCutoffMinutes ?? null,
    isDayOff,
    hasAssignment,
    isHoliday: holidayName != null,
    holidayName,
    holidayOverUnassigned: !hasAssignment && holidayName != null,
    dayOffReason: dayOffRow?.reason ?? null,
    policyMissing
  };
}

// --- setCellShiftFn ---

export const setCellShiftFn = createServerFn({ method: 'POST' })
  .validator(setCellShiftSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(dateOverrides)
          .where(and(eq(dateOverrides.user_id, data.userId), eq(dateOverrides.date, data.date)));
        // Orphan-prevention guard: if a `day_offs` row exists for this
        // (user, date), delete it so the new override takes precedence
        // immediately instead of being masked. The popover's conflict UX
        // already enforces this client-side; this DELETE is the
        // server-side mirror (see EPIC_SUMMARY § Follow-ups #2).
        await tx
          .delete(dayOffs)
          .where(and(eq(dayOffs.user_id, data.userId), eq(dayOffs.date, data.date)));
        await tx.insert(dateOverrides).values({
          user_id: data.userId,
          date: data.date,
          shift_id: data.shiftId,
          created_by: session.user.id
        });
      });
      const cell = await resolveSingleCell({ userId: data.userId, date: data.date });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.setCellShift');
      return { success: false, error: ERROR_INTERNAL };
    }
  });

// --- setCellDayOffFn ---

export const setCellDayOffFn = createServerFn({ method: 'POST' })
  .validator(setCellDayOffSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(dateOverrides)
          .where(and(eq(dateOverrides.user_id, data.userId), eq(dateOverrides.date, data.date)));
        await tx
          .delete(dayOffs)
          .where(and(eq(dayOffs.user_id, data.userId), eq(dayOffs.date, data.date)));
        await tx.insert(dayOffs).values({
          user_id: data.userId,
          date: data.date,
          reason: data.reason ?? null,
          created_by: session.user.id
        });
      });
      const cell = await resolveSingleCell({ userId: data.userId, date: data.date });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.setCellDayOff');
      return { success: false, error: ERROR_INTERNAL };
    }
  });

// --- clearCellFn ---

export const clearCellFn = createServerFn({ method: 'POST' })
  .validator(clearCellSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(dateOverrides)
          .where(and(eq(dateOverrides.user_id, data.userId), eq(dateOverrides.date, data.date)));
        await tx
          .delete(dayOffs)
          .where(and(eq(dayOffs.user_id, data.userId), eq(dayOffs.date, data.date)));
      });
      const cell = await resolveSingleCell({ userId: data.userId, date: data.date });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.clearCell');
      return { success: false, error: ERROR_INTERNAL };
    }
  });

// --- applyToWholeWeekFn ---

export const applyToWholeWeekFn = createServerFn({ method: 'POST' })
  .validator(applyToWholeWeekSchema)
  .handler(async ({ data }): Promise<BulkResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    if (data.mode === 'shift' && data.shiftId == null) {
      return { success: false, error: ERROR_SHIFT_ID_REQUIRED };
    }

    const dates: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(data.weekStart, i);
      if (
        !data.includeWeekend &&
        WEEKEND_DAYS.includes(dayOfWeek(date) as (typeof WEEKEND_DAYS)[number])
      ) {
        continue;
      }
      dates.push(date);
    }

    let daysApplied = 0;
    const partialFailures: Array<{ date: string; error: string }> = [];
    const affectedDates: string[] = [];

    for (const date of dates) {
      try {
        if (data.mode === 'shift') {
          await db.transaction(async (tx) => {
            await tx
              .delete(dateOverrides)
              .where(and(eq(dateOverrides.user_id, data.userId), eq(dateOverrides.date, date)));
            // Orphan-prevention guard (matches `setCellShiftFn`).
            await tx
              .delete(dayOffs)
              .where(and(eq(dayOffs.user_id, data.userId), eq(dayOffs.date, date)));
            await tx.insert(dateOverrides).values({
              user_id: data.userId,
              date,
              shift_id: data.shiftId!,
              created_by: session.user.id
            });
          });
        } else {
          await db.transaction(async (tx) => {
            await tx
              .delete(dateOverrides)
              .where(and(eq(dateOverrides.user_id, data.userId), eq(dateOverrides.date, date)));
            await tx
              .delete(dayOffs)
              .where(and(eq(dayOffs.user_id, data.userId), eq(dayOffs.date, date)));
            await tx.insert(dayOffs).values({
              user_id: data.userId,
              date,
              reason: data.reason ?? null,
              created_by: session.user.id
            });
          });
        }
        daysApplied += 1;
        affectedDates.push(date);
      } catch (e) {
        mapDbError(e, `scheduleGrid.applyToWeek.${date}`);
        partialFailures.push({ date, error: ERROR_INTERNAL });
      }
    }

    return {
      success: true,
      daysApplied,
      partialFailures,
      affectedUserId: data.userId,
      affectedDates
    };
  });
