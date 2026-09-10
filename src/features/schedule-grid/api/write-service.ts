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
 *                           aborting the whole batch. Weekend handling uses
 *                           the shared `isWeekendDate` helper (Sat/Sun); when
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
 *
 * The three single-cell fns (`setCellShiftFn`, `setCellDayOffFn`,
 * `clearCellFn`) share the transaction + re-resolve + error-folding
 * scaffolding through `withCellWrite`; `applyToWholeWeekFn` keeps its own
 * per-date loop because failures are captured into `partialFailures`
 * instead of aborting the batch. The DELETE-then-INSERT itself (including
 * the orphan-prevention guard) lives in `./cell-write` and is shared with
 * `repeatWeekBulkFn` in `bulk-service.ts`.
 */

import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { addDays, isWeekendDate } from '../utils/date-utils';
import { resolveScheduleGridCell } from './cell-resolver';
import { clearCellTx, writeCellDayOffTx, writeCellShiftTx, type DbTransaction } from './cell-write';
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
 * state of the affected cell, re-resolved via `resolveScheduleGridCell`
 * (see `./cell-resolver`) so the popover can update its React Query cache
 * directly. The write and read paths share one cell builder, so
 * "re-resolve after write" is provably identical to a fresh fetch —
 * including holiday handling.
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
 * Shared scaffolding for the single-cell write fns (`setCellShiftFn`,
 * `setCellDayOffFn`, `clearCellFn`): run the write inside one DB
 * transaction, re-resolve the affected cell via `resolveScheduleGridCell`
 * (the same builder the read path uses) so the React Query cache update
 * matches a fresh fetch, then fold any failure through a single
 * `mapDbError` catch block into the `{ success: false }` tuple. The
 * `context` string is the `mapDbError` log context; the caller keeps its
 * `requirePermission` / `checkRateLimit` preamble.
 */
async function withCellWrite(
  context: string,
  input: { userId: string; date: string },
  fn: (tx: DbTransaction) => Promise<void>
): Promise<CellWriteResult> {
  try {
    await db.transaction(fn);
    const cell = await resolveScheduleGridCell(input.userId, input.date);
    return {
      success: true,
      cell,
      affectedUserId: input.userId,
      affectedDates: [input.date]
    };
  } catch (error) {
    mapDbError(error, context);
    return { success: false, error: ERROR_INTERNAL };
  }
}

// --- setCellShiftFn ---

export const setCellShiftFn = createServerFn({ method: 'POST' })
  .validator(setCellShiftSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    return withCellWrite('scheduleGrid.setCellShift', data, async (tx) => {
      await writeCellShiftTx(tx, {
        userId: data.userId,
        date: data.date,
        shiftId: data.shiftId,
        createdBy: session.user.id
      });
    });
  });

// --- setCellDayOffFn ---

export const setCellDayOffFn = createServerFn({ method: 'POST' })
  .validator(setCellDayOffSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    return withCellWrite('scheduleGrid.setCellDayOff', data, async (tx) => {
      await writeCellDayOffTx(tx, {
        userId: data.userId,
        date: data.date,
        reason: data.reason,
        createdBy: session.user.id
      });
    });
  });

// --- clearCellFn ---

export const clearCellFn = createServerFn({ method: 'POST' })
  .validator(clearCellSchema)
  .handler(async ({ data }): Promise<CellWriteResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    return withCellWrite('scheduleGrid.clearCell', data, async (tx) => {
      await clearCellTx(tx, { userId: data.userId, date: data.date });
    });
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
      if (!data.includeWeekend && isWeekendDate(date)) {
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
            await writeCellShiftTx(tx, {
              userId: data.userId,
              date,
              shiftId: data.shiftId!,
              createdBy: session.user.id
            });
          });
        } else {
          await db.transaction(async (tx) => {
            await writeCellDayOffTx(tx, {
              userId: data.userId,
              date,
              reason: data.reason,
              createdBy: session.user.id
            });
          });
        }
        daysApplied += 1;
        affectedDates.push(date);
      } catch (error) {
        // Non-throwing log (NOT `mapDbError`, which throws `never`) so one
        // failing date lands in `partialFailures` without aborting the
        // remaining batch — same pattern as `repeatWeekBulkFn`.
        logger.error({ err: error, userId: data.userId, date }, '[db:scheduleGrid.applyToWeek]');
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
