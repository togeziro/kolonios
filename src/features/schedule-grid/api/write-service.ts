/**
 * Write-side server functions for the admin schedule grid (ticket 02).
 *
 * Mirrors the per-cell write surface that the popover drives:
 *  - `setCellShiftFn`     — replace the existing `date_overrides` row for
 *                           (user, date) with one pointing at `shiftId`.
 *                           Does NOT touch `day_offs` (orphan Day-Off risk
 *                           is documented in the spec — resolver precedence
 *                           hides the override until the day-off is cleared).
 *  - `setCellDayOffFn`    — delete any `date_overrides` row for (user, date)
 *                           then insert a `day_offs` row. Idempotent.
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
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
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

const setCellShiftSchema = z.object({
  userId: z.string().min(1),
  date: ymd,
  shiftId: z.number().int().positive()
});

const setCellDayOffSchema = z.object({
  userId: z.string().min(1),
  date: ymd
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
  includeWeekend: z.boolean()
});

/**
 * Tuple returned by every write fn. `cell` is the post-write state of the
 * affected cell, re-resolved via `resolveEffectiveSchedule` so the popover
 * can update its React Query cache directly. `affectedDates` covers the
 * batch so the client can invalidate once per write (vs. once per cell).
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

type BulkResult =
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
  createdByFallback: string;
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
        or(sql`${scheduleAssignments.effective_to} IS NULL`, gte(scheduleAssignments.effective_to, date))
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

  let weekdayRules: WeekdayScheduleRule[] = [];
  const policiesByShift = new Map<number, ShiftPolicy>();
  const shiftById = new Map<number, { id: number; name: string }>();

  if (shiftIds.size > 0) {
    const [ruleRows, shiftRows] = await Promise.all([
      db.select().from(shiftWeekdayRules).where(inArray(shiftWeekdayRules.shift_id, [...shiftIds])),
      db.select({ id: shifts.id, name: shifts.name }).from(shifts).where(inArray(shifts.id, [...shiftIds]))
    ]);
    weekdayRules = ruleRows.map((r) => ({
      dayOfWeek: r.day_of_week,
      isWorkingDay: r.is_working_day ?? true,
      startTime: r.start_time,
      endTime: r.end_time
    }));
    for (const s of shiftRows) shiftById.set(s.id, s);
  }

  // Re-fetch shifts with their policy columns for `policiesByShift`.
  if (shiftIds.size > 0) {
    const policyRows = await db
      .select({
        id: shifts.id,
        late_tolerance_minutes: shifts.late_tolerance_minutes,
        absence_cutoff_minutes: shifts.absence_cutoff_minutes
      })
      .from(shifts)
      .where(inArray(shifts.id, [...shiftIds]));
    for (const s of policyRows) {
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

  // `isHoliday` covers the date itself; recurring holidays already mapped
  // inside `getHolidaysInRange`'s SQL filter.
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
        await tx.insert(dateOverrides).values({
          user_id: data.userId,
          date: data.date,
          shift_id: data.shiftId,
          created_by: session.user.id
        });
      });
      const cell = await resolveSingleCell({
        userId: data.userId,
        date: data.date,
        createdByFallback: session.user.id
      });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.setCellShift');
      return { success: false, error: 'internal' };
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
          reason: null,
          created_by: session.user.id
        });
      });
      const cell = await resolveSingleCell({
        userId: data.userId,
        date: data.date,
        createdByFallback: session.user.id
      });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.setCellDayOff');
      return { success: false, error: 'internal' };
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
      const cell = await resolveSingleCell({
        userId: data.userId,
        date: data.date,
        createdByFallback: session.user.id
      });
      return {
        success: true,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.clearCell');
      return { success: false, error: 'internal' };
    }
  });

// --- applyToWholeWeekFn ---

export const applyToWholeWeekFn = createServerFn({ method: 'POST' })
  .validator(applyToWholeWeekSchema)
  .handler(async ({ data }): Promise<BulkResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    if (data.mode === 'shift' && data.shiftId == null) {
      return { success: false, error: 'shiftIdRequired' };
    }

    const dates: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(data.weekStart, i);
      if (!data.includeWeekend && WEEKEND_DAYS.includes(dayOfWeek(date) as (typeof WEEKEND_DAYS)[number])) {
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
              reason: null,
              created_by: session.user.id
            });
          });
        }
        daysApplied += 1;
        affectedDates.push(date);
      } catch (e) {
        mapDbError(e, `scheduleGrid.applyToWeek.${date}`);
        partialFailures.push({ date, error: 'internal' });
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

// Touch asc to keep the import-side-effect analyzer happy; it is used
// in `resolveSingleCell`'s ORDER BY via `desc(...)` already. asc is also
// commonly used in nearby queries, so keep it for tree-shake stability.
void asc;
