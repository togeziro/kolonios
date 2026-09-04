/**
 * Bulk "Repeat Schedule in Bulk" server fn for the admin schedule grid
 * (ticket 03, Kerjoo `e42` parity).
 *
 * Copies one source week's `date_overrides` + `day_offs` rows onto each of
 * up to 12 target weeks, for every employee matching the active filter
 * (division + search) or an explicit `userIds` list (cap 200).
 *
 * Data model: `schedule_assignments` are persistent templates (open-ended),
 * so assignment-driven cells need no copy — the template already resolves
 * them on every target week. Only the week-specific exceptions admins enter
 * through the grid — shift overrides (`date_overrides`) and day offs
 * (`day_offs`) — are duplicated forward. Source dates with no override /
 * day-off row (weekday-rule cells, unassigned cells, and the `policyMissing`
 * "—" state of `hasAssignment && !isDayOff && resolved == null`) are
 * skipped: there is nothing explicit to replicate.
 *
 * Each target cell is written in its own DB transaction via DELETE-then-
 * INSERT (delete the target's `date_overrides` + `day_offs` rows first, then
 * insert the copied row) so the `date_overrides_user_date_unique` /
 * `day_offs_user_date_unique` constraints can never fire and a masked
 * orphan (a `day_offs` row hiding under a new override) is prevented — the
 * same orphan guard as `setCellShiftFn` / `setCellDayOffFn`.
 *
 * Failure semantics: per-cell failures are captured into `partialFailures`
 * (`[{ userId, date, error }]`) and NEVER abort the batch. The per-cell
 * catch logs via the non-throwing `logger` and continues; `mapDbError` is
 * only used for unexpected top-level failures, mirroring the outer tuple
 * convention of the other write fns. `applyToWholeWeekFn` uses the same
 * `logger.error` + continue pattern for its per-date catch (fixed in the
 * follow-up session; previously it called the throwing `mapDbError` there,
 * which aborted the batch on the first failing date).
 *
 * When `includeWeekend === false`, weekend offsets (`WEEKEND_DAYS = Sat/Sun`,
 * via the shared `isWeekendDate` helper) are neither read from the source
 * nor written to any target.
 */

import { createServerFn } from '@tanstack/react-start';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import * as z from 'zod';

import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs } from '@/lib/db/schema/attendance';
import { employees } from '@/lib/db/schema/employees';
import { isWeekendDate, addDays, parseDate, DAY_MS } from '../utils/date-utils';
import { buildEmployeeWhere } from './service';
import { SCHEDULE_GRID_MAX_PAGE_SIZE } from './validation';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const repeatWeekBulkSchema = z.object({
  sourceWeekStart: ymd,
  targetWeekStarts: z.array(ymd).min(1).max(12),
  userIds: z.array(z.string().min(1)).min(1).max(SCHEDULE_GRID_MAX_PAGE_SIZE).optional(),
  divisionId: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  includeWeekend: z.boolean()
});

export type RepeatWeekBulkInput = z.infer<typeof repeatWeekBulkSchema>;

export type RepeatWeekBulkResult =
  | {
      success: true;
      /** Distinct target weeks that received at least one successful write. */
      weeksApplied: number;
      /** Distinct users that received at least one successful write. */
      usersAffected: number;
      /** Total successfully written (user, target date) cells. */
      cellsApplied: number;
      partialFailures: Array<{ userId: string; date: string; error: string }>;
    }
  | {
      success: false;
      error: string;
    };

const ERROR_INTERNAL = 'internal' as const;

/** One copyable source-week cell: an explicit override or day off. */
type SourceCell = { kind: 'dayOff'; reason: string | null } | { kind: 'override'; shiftId: number };

/**
 * Resolve the target user list. An explicit non-empty `userIds` array wins
 * (deduped, capped); otherwise every employee matching the grid filter
 * (`divisionId` + `query`, via the shared `buildEmployeeWhere`) is used,
 * capped at `SCHEDULE_GRID_MAX_PAGE_SIZE` (200).
 */
async function resolveBulkUserIds(data: RepeatWeekBulkInput): Promise<string[]> {
  if (data.userIds && data.userIds.length > 0) {
    return [...new Set(data.userIds)].slice(0, SCHEDULE_GRID_MAX_PAGE_SIZE);
  }
  const divisionId = data.divisionId ? Number(data.divisionId) : null;
  const search = data.query?.trim() ? data.query.trim() : null;
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(buildEmployeeWhere(divisionId, search))
    .orderBy(asc(employees.full_name))
    .limit(SCHEDULE_GRID_MAX_PAGE_SIZE);
  return rows.map((r) => r.id);
}

/**
 * Read one source week of explicit rows for every user in a single batched
 * pass (one overrides query + one day-offs query). Returns, per user, the
 * map of source date → copyable cell. Dates that carry no row are absent —
 * weekday-rule cells and the blank `policyMissing` state have nothing to
 * replicate. Weekend offsets are dropped here when `includeWeekend` is
 * false (shared `isWeekendDate` helper, same skip as `applyToWholeWeekFn`).
 */
async function readSourceWeek(
  userIds: string[],
  sourceWeekStart: string,
  includeWeekend: boolean
): Promise<Map<string, Map<string, SourceCell>>> {
  const sourceWeekEnd = addDays(sourceWeekStart, 6);

  const [overrideRows, dayOffRows] = await Promise.all([
    db
      .select()
      .from(dateOverrides)
      .where(
        and(
          inArray(dateOverrides.user_id, userIds),
          gte(dateOverrides.date, sourceWeekStart),
          lte(dateOverrides.date, sourceWeekEnd)
        )
      ),
    db
      .select()
      .from(dayOffs)
      .where(
        and(
          inArray(dayOffs.user_id, userIds),
          gte(dayOffs.date, sourceWeekStart),
          lte(dayOffs.date, sourceWeekEnd)
        )
      )
  ]);

  const byUser = new Map<string, Map<string, SourceCell>>();
  const cellFor = (userId: string): Map<string, SourceCell> => {
    let cells = byUser.get(userId);
    if (!cells) {
      cells = new Map<string, SourceCell>();
      byUser.set(userId, cells);
    }
    return cells;
  };

  // Day offs take precedence (mirrors `resolveEffectiveSchedule`); an
  // override row shadowed by a day off is inert and must not be copied.
  for (const row of dayOffRows) {
    if (!includeWeekend && isWeekendDate(row.date)) continue;
    cellFor(row.user_id).set(row.date, { kind: 'dayOff', reason: row.reason });
  }
  for (const row of overrideRows) {
    if (!includeWeekend && isWeekendDate(row.date)) continue;
    const cells = cellFor(row.user_id);
    if (!cells.has(row.date)) {
      cells.set(row.date, { kind: 'override', shiftId: row.shift_id });
    }
  }
  return byUser;
}

/**
 * Day offset of `date` relative to `weekStart` (0..6 for in-week dates).
 */
function weekOffset(weekStart: string, date: string): number {
  return Math.round((parseDate(date).getTime() - parseDate(weekStart).getTime()) / DAY_MS);
}

export const repeatWeekBulkFn = createServerFn({ method: 'POST' })
  .validator(repeatWeekBulkSchema)
  .handler(async ({ data }): Promise<RepeatWeekBulkResult> => {
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);

    try {
      const userIds = await resolveBulkUserIds(data);
      if (userIds.length === 0) {
        return {
          success: true,
          weeksApplied: 0,
          usersAffected: 0,
          cellsApplied: 0,
          partialFailures: []
        };
      }

      const targetWeekStarts = [...new Set(data.targetWeekStarts)];
      const sourceByUser = await readSourceWeek(userIds, data.sourceWeekStart, data.includeWeekend);

      let cellsApplied = 0;
      const partialFailures: Array<{ userId: string; date: string; error: string }> = [];
      const appliedWeeks = new Set<string>();
      const appliedUsers = new Set<string>();

      for (const [userId, cellsByDate] of sourceByUser) {
        // Chronological per-user processing (Mon→Sun) so repeated runs,
        // logs, and `partialFailures` read in a predictable order.
        const orderedCells = [...cellsByDate].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        for (const [sourceDate, cell] of orderedCells) {
          const offset = weekOffset(data.sourceWeekStart, sourceDate);
          if (offset < 0 || offset > 6) continue;
          for (const targetWeekStart of targetWeekStarts) {
            const targetDate = addDays(targetWeekStart, offset);
            try {
              await db.transaction(async (tx) => {
                await tx
                  .delete(dateOverrides)
                  .where(
                    and(eq(dateOverrides.user_id, userId), eq(dateOverrides.date, targetDate))
                  );
                // Orphan-prevention guard (matches `setCellShiftFn` /
                // `setCellDayOffFn`): clear the sibling row so the insert
                // below cannot be masked by a stale counterpart.
                await tx
                  .delete(dayOffs)
                  .where(and(eq(dayOffs.user_id, userId), eq(dayOffs.date, targetDate)));
                if (cell.kind === 'override') {
                  await tx.insert(dateOverrides).values({
                    user_id: userId,
                    date: targetDate,
                    shift_id: cell.shiftId,
                    created_by: session.user.id
                  });
                } else {
                  await tx.insert(dayOffs).values({
                    user_id: userId,
                    date: targetDate,
                    reason: cell.reason ?? null,
                    created_by: session.user.id
                  });
                }
              });
              cellsApplied += 1;
              appliedWeeks.add(targetWeekStart);
              appliedUsers.add(userId);
            } catch (e) {
              // Non-throwing log (NOT `mapDbError`, which throws) so one
              // failing cell never aborts the remaining batch.
              logger.error(
                { err: e, userId, date: targetDate },
                '[db:scheduleGrid.repeatWeekBulk]'
              );
              partialFailures.push({ userId, date: targetDate, error: ERROR_INTERNAL });
            }
          }
        }
      }

      return {
        success: true,
        weeksApplied: appliedWeeks.size,
        usersAffected: appliedUsers.size,
        cellsApplied,
        partialFailures
      };
    } catch (e) {
      mapDbError(e, 'scheduleGrid.repeatWeekBulk');
      return { success: false, error: ERROR_INTERNAL };
    }
  });
