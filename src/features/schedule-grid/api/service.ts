import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { db } from '@/lib/db';
import { scheduleAssignmentRangeValid } from '@/lib/db/attendance';
import { departments } from '@/lib/db/schema/masterdata';
import { scheduleAssignments } from '@/lib/db/schema/attendance';
import { employees } from '@/lib/db/schema/employees';
import { resolveScheduleGridCells, resolveScheduleGridCell } from './cell-resolver';
import { clearCellTx } from './cell-write';
import {
  SCHEDULE_GRID_MAX_PAGE_SIZE,
  scheduleGridFiltersSchema,
  assignShiftInlineSchema,
  deleteAssignmentSchema,
  clearWeekSchema
} from './validation';
import type { ScheduleGridCell, ScheduleGridResponse, ScheduleGridRow } from './types';
import type {
  ScheduleGridFiltersInput,
  AssignShiftInlineInput,
  DeleteAssignmentInput,
  ClearWeekInput
} from './validation';
import { addDays, weekDays } from '../utils/date-utils';
import { planClearAssignmentRange } from '../utils/clear-week';

const DEFAULT_PAGE_SIZE = 25;

/**
 * Row shape shared by `getScheduleGridFn` and the month export. The export
 * reuses the same batched per-week resolution instead of forking the engine.
 */
export type ScheduleEmployeeRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentId: number | null;
};

/**
 * Build the employee filter predicate (division + search) shared by the grid
 * listing and the month export.
 */
export function buildEmployeeWhere(divisionId: number | null, search: string | null | undefined) {
  return and(
    divisionId != null ? eq(employees.department_id, divisionId) : undefined,
    search && search.length > 0
      ? or(
          ilike(employees.full_name, `%${search}%`),
          ilike(employees.email, `%${search}%`),
          ilike(employees.employee_code, `%${search}%`)
        )
      : undefined
  );
}

/**
 * Resolve one 7-day window for a set of employees and adorn each resolved
 * cell with the employee's name / department to build the grid rows.
 *
 * The heavy lifting — batched loads, the `resolveEffectiveSchedule` call,
 * holiday projection, and cell shape — lives in `resolveScheduleGridCells`
 * (`./cell-resolver`), which the write-side re-resolve shares, so precedence
 * changes are a single edit and the two paths cannot drift. This function is
 * the read-side decorator: it maps resolved cells (keyed by date) into
 * ordered `ScheduleGridRow`s. Returns both the wire rows and the
 * holiday-by-date map so `getScheduleGridFn` keeps its response shape while
 * the month export reuses the exact same resolver.
 */
export async function resolveWeekForEmployees(
  employeeRows: ScheduleEmployeeRow[],
  deptNameById: Map<number, string>,
  weekStart: string
): Promise<{
  rows: ScheduleGridRow[];
  holidaysByDate: Record<string, string>;
}> {
  const weekEnd = addDays(weekStart, 6);
  const weekDates = weekDays(weekStart);

  const { byUser, holidaysByDate } = await resolveScheduleGridCells({
    userIds: employeeRows.map((e) => e.id),
    startDate: weekStart,
    endDate: weekEnd
  });

  const rows: ScheduleGridRow[] = employeeRows.map((employee) => {
    // `resolveScheduleGridCells` emits an entry for every requested userId and
    // a cell for every date in the window, so both lookups below are total.
    const resolved = byUser.get(employee.id)!;
    const cells: ScheduleGridCell[] = weekDates.map((date) => resolved.cells.get(date)!);

    return {
      userId: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      divisionId: employee.departmentId,
      divisionName:
        employee.departmentId != null ? (deptNameById.get(employee.departmentId) ?? '') : '',
      cells,
      activeShiftName: resolved.activeShiftName,
      // Ticket 03: row-level flag drives the "+ Assign Shift" CTA in the
      // row header. True when at least one cell resolves against an
      // active `schedule_assignments` row.
      hasAssignment: cells.some((c) => c.hasAssignment)
    };
  });

  return { rows, holidaysByDate };
}

/**
 * Read-only weekly schedule grid for admin/HR.
 *
 * Returns one row per employee with seven pre-resolved cells (0..6 of the
 * week starting at `weekStart`). Resolution uses the existing
 * `resolveEffectiveSchedule` engine — we do NOT fork the precedence rules.
 *
 * Batched to avoid N+1: for any page of employees we issue 7 aggregate
 * queries (employees, assignments, distinct shifts, weekday rules,
 * shifts/policies, date overrides, day offs) and resolve in memory.
 */
export const getScheduleGridFn = createServerFn({ method: 'GET' })
  .validator(scheduleGridFiltersSchema)
  .handler(async ({ data }: { data: ScheduleGridFiltersInput }): Promise<ScheduleGridResponse> => {
    await requirePermission('attendance_admin', 'view');

    const weekStart = data.weekStart;
    const weekEnd = addDays(weekStart, 6);
    const month = data.month;
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(
      SCHEDULE_GRID_MAX_PAGE_SIZE,
      Math.max(1, data.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const offset = (page - 1) * pageSize;
    const search = data.query?.trim();
    const divisionId = data.divisionId ? Number(data.divisionId) : null;

    // 1) Employees + division filter + search + pagination — single query
    const employeeWhere = buildEmployeeWhere(divisionId, search);

    const [[{ count }], employeeRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(employeeWhere),
      db
        .select({
          id: employees.id,
          employeeCode: employees.employee_code,
          fullName: employees.full_name,
          departmentId: employees.department_id
        })
        .from(employees)
        .where(employeeWhere)
        .orderBy(asc(employees.full_name))
        .limit(pageSize)
        .offset(offset)
    ]);

    // Department name lookup — fetch only the divisions we actually need.
    const deptIds = Array.from(
      new Set(employeeRows.map((e) => e.departmentId).filter((id): id is number => id != null))
    );
    const deptRows =
      deptIds.length > 0
        ? await db
            .select({ id: departments.id, name: departments.name })
            .from(departments)
            .where(inArray(departments.id, deptIds))
        : [];
    const deptNameById = new Map<number, string>(deptRows.map((d) => [d.id, d.name]));

    // 2..7) Batched per-week resolution — shared with the month export
    // (see `resolveWeekForEmployees` below). Skipped when there are no
    // employees on the page (the grid renders an empty page with the same
    // shape).
    const { rows, holidaysByDate } = await resolveWeekForEmployees(
      employeeRows,
      deptNameById,
      weekStart
    );

    const response: ScheduleGridResponse = {
      month,
      weekStart,
      weekEnd,
      rows,
      total: count,
      page,
      pageSize,
      holidays: { byDate: holidaysByDate }
    };

    return response;
  });

/**
 * Inline "Assign Shift" server fn for the row-header CTA in the schedule
 * grid (ticket 03). Creates a `schedule_assignments` row for an employee
 * who currently has none, so the row's "—" cells can start resolving to
 * real shift data.
 *
 * Behavior:
 *   - Auto-closes any pre-existing assignment covering the new
 *     `effectiveFrom` for the same user by setting
 *     `effective_to = effectiveFrom - 1 day` (admin is GOD MODE — no 422),
 *     EXCEPT when that would write an inverted range (`effectiveFrom` on or
 *     before the old row's start), or when the new range would swallow
 *     another row's head (a row starting inside the new range): the whole
 *     request is then rejected with
 *     `{ success: false, error: 'closeWouldInvertRange' }` and nothing is
 *     written. Silently skipping the close is NOT an option — the old row
 *     would keep covering the new range's head and win the per-date
 *     most-recent pick for it.
 *   - Wraps the close + insert in a single DB transaction so a partial
 *     state can never be observed.
 *   - `effectiveTo` is REQUIRED (bounded assignments only): a missing end
 *     date is rejected with `{ success: false, error: 'effectiveToRequired' }`
 *     (`effective_to` is NOT NULL at the DB level — open-ended rows cannot
 *     exist).
 *   - Cross-field rule `effectiveTo > effectiveFrom` is enforced here
 *     (NOT in the zod schema) so the dialog can keep field-level
 *     `required` markers per repo convention.
 *   - Returns `{ success, assignment, closedAssignment? }` per the
 *     `src/lib/db/attendance.ts` tuple convention. Errors are folded via
 *     `mapDbError` rather than thrown.
 */
export const createAssignmentInlineFn = createServerFn({ method: 'POST' })
  .validator(assignShiftInlineSchema)
  .handler(async ({ data }: { data: AssignShiftInlineInput }) => {
    const session = await requirePermission('attendance_admin', 'add');
    await checkRateLimit(`write:${session.user.id}`);

    // `effectiveTo` is required — assignments are always bounded. A missing
    // end date used to mean "open-ended forever"; reject it explicitly so
    // the admin picks a real end date (tuple, not zod, per repo convention).
    if (!data.effectiveTo) {
      return {
        success: false as const,
        error: 'effectiveToRequired' as const
      };
    }

    // `<=` also rejects single-day ranges (`effectiveTo === effectiveFrom`) —
    // assignments must be bounded multi-day ranges.
    if (data.effectiveTo <= data.effectiveFrom) {
      return {
        success: false as const,
        error: 'effectiveToBeforeFrom' as const
      };
    }

    // Copy into locals: property narrowing on `data.*` does not survive
    // into the transaction closure below. `effectiveTo` is narrowed to
    // `string` by the `effectiveToRequired` guard above.
    const { userId, shiftId, effectiveFrom } = data;
    const effectiveTo: string = data.effectiveTo;

    // Inverted-range hazard (prod incident: dhani 2026-09-14 →
    // 2026-09-07): closing a covering row whose start is after the new
    // effectiveFrom would write an empty range that still wins
    // `ORDER BY effective_from DESC` overlap picks. Likewise a new range
    // that swallows another row's head (row starts inside the new range)
    // would leave a silently shadowed overlap. Reject instead of writing —
    // the admin picks dates around the conflicting assignment or ends it
    // first. YYYY-MM-DD lex compare is chronological, no parsing needed.
    // The lookup + reject + write stay in one transaction so the check
    // cannot race a concurrent close.
    try {
      const result = await db.transaction(async (tx) => {
        const covering = await tx
          .select()
          .from(scheduleAssignments)
          .where(
            and(
              eq(scheduleAssignments.user_id, userId),
              lte(scheduleAssignments.effective_from, effectiveFrom),
              gte(scheduleAssignments.effective_to, effectiveFrom)
            )
          )
          .orderBy(desc(scheduleAssignments.effective_from));

        for (const row of covering) {
          if (addDays(effectiveFrom, -1) < row.effective_from) {
            return {
              rejected: true as const,
              conflictingFrom: row.effective_from
            };
          }
        }

        // Rows starting strictly inside the new range would overlap it
        // without being closed by the loop above (they don't cover
        // `effectiveFrom`) — reject so no overlap is ever written silently.
        const [swallowed] = await tx
          .select({ effective_from: scheduleAssignments.effective_from })
          .from(scheduleAssignments)
          .where(
            and(
              eq(scheduleAssignments.user_id, userId),
              sql`${scheduleAssignments.effective_from} > ${effectiveFrom}`,
              lte(scheduleAssignments.effective_from, effectiveTo)
            )
          )
          .orderBy(asc(scheduleAssignments.effective_from))
          .limit(1);
        if (swallowed) {
          return {
            rejected: true as const,
            conflictingFrom: swallowed.effective_from
          };
        }

        let closedAssignment: typeof scheduleAssignments.$inferSelect | null = null;
        for (const row of covering) {
          const closingDate = addDays(effectiveFrom, -1);
          const [updated] = await tx
            .update(scheduleAssignments)
            .set({ effective_to: closingDate, updated_at: new Date() })
            .where(eq(scheduleAssignments.id, row.id))
            .returning();
          // Report the most recent (highest effective_from) closed row —
          // it is first under the DESC ordering above.
          closedAssignment ??= updated ?? null;
        }

        const [assignment] = await tx
          .insert(scheduleAssignments)
          .values({
            user_id: userId,
            shift_id: shiftId,
            effective_from: effectiveFrom,
            effective_to: effectiveTo,
            created_by: session.user.id
          })
          .returning();

        return { assignment, closedAssignment };
      });

      if ('rejected' in result) {
        return {
          success: false as const,
          error: 'closeWouldInvertRange' as const,
          conflictingFrom: result.conflictingFrom
        };
      }

      return {
        success: true as const,
        assignment: result.assignment,
        ...(result.closedAssignment ? { closedAssignment: result.closedAssignment } : {})
      };
    } catch (error) {
      // mapDbError logs + throws a DomainError; the client wraps the call
      // in try/catch and surfaces errorGeneric. We don't return a tuple
      // here because `mapDbError`'s return type is `never`.
      mapDbError(error, 'scheduleGrid.createAssignmentInline');
    }
  });

/**
 * "Delete schedule" (the grid popover's destructive counterpart to
 * `createAssignmentInlineFn`).
 *
 * Removes ONE `schedule_assignments` row — the range the cell resolved
 * against — addressed by `assignmentId`. Deleting the whole range is the
 * point: an assignment is a bounded range, so "delete the schedule for this
 * day" is meaningless without saying what happens to its other days, and
 * silently splitting the range would leave the admin with a schedule they
 * never asked for. The confirm dialog names the full range before the write.
 *
 * Contract:
 *   - `assignmentId` is scoped by `user_id`, so a stale or tampered payload
 *     can never delete another employee's assignment.
 *   - Per-date `date_overrides` / `day_offs` rows are deliberately NOT
 *     touched: they are independent of the assignment and the resolver
 *     already ignores an override that has no assignment behind it (a
 *     `date_overrides` row with no covering assignment resolves to no
 *     weekday rules → the cell falls back to "—"), while an orphan day-off
 *     still renders as Day Off. Deleting them here would destroy attendance
 *     context the admin did not ask to remove.
 *   - Returns the post-delete cell via `resolveScheduleGridCell` (the read
 *     path's own builder), so the popover's cache refresh matches a fresh
 *     fetch exactly — same contract as the per-cell writes in
 *     `write-service.ts`.
 *   - Tuple convention: `{ success: true, ... }` / `{ success: false, error }`,
 *     with `notFound` reported separately from `internal` so the client can
 *     re-sync instead of claiming the delete failed.
 */
export type DeleteAssignmentResult =
  | {
      success: true;
      deletedId: number;
      effectiveFrom: string;
      effectiveTo: string;
      cell: ScheduleGridCell;
      affectedUserId: string;
      affectedDates: string[];
    }
  | {
      success: false;
      error: 'notFound' | 'internal';
    };

export const deleteAssignmentFn = createServerFn({ method: 'POST' })
  .validator(deleteAssignmentSchema)
  .handler(async ({ data }: { data: DeleteAssignmentInput }): Promise<DeleteAssignmentResult> => {
    const session = await requirePermission('attendance_admin', 'delete');
    await checkRateLimit(`write:${session.user.id}`);

    try {
      const deleted = await db.transaction(async (tx) => {
        const [row] = await tx
          .delete(scheduleAssignments)
          .where(
            and(
              eq(scheduleAssignments.id, data.assignmentId),
              eq(scheduleAssignments.user_id, data.userId)
            )
          )
          .returning();
        return row ?? null;
      });

      if (!deleted) {
        // Already gone (double-click, concurrent admin, stale cell). Not an
        // error worth alarming over — the client just re-syncs the grid.
        return { success: false as const, error: 'notFound' as const };
      }

      const cell = await resolveScheduleGridCell(data.userId, data.date);
      return {
        success: true as const,
        deletedId: deleted.id,
        effectiveFrom: deleted.effective_from,
        effectiveTo: deleted.effective_to,
        cell,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    } catch (error) {
      mapDbError(error, 'scheduleGrid.deleteAssignment');
      return { success: false as const, error: 'internal' as const };
    }
  });

/**
 * "Clear week" — wipe ONE employee's whole schedule for the visible week.
 *
 * The row-header escape hatch for the case the per-cell popover cannot
 * reach: an orphan `day_offs` row (no covering assignment) renders as Day
 * Off but never opens a popover, so it had no Clear action. This removes
 * everything the employee has inside `[weekStart, weekStart + 6]`:
 *
 *   - every `date_overrides` and `day_offs` row in the window (via
 *     `clearCellTx`, the shared orphan-prevention guard — never forked);
 *   - their `schedule_assignments` coverage: a range fully inside the week
 *     is deleted; a range overlapping one edge is trimmed (start or end);
 *     a range spanning the whole week is split into a head and a tail, so
 *     every day OUTSIDE the week is preserved. See `planClearAssignmentRange`
 *     for the pure decision and its never-inverted guarantee.
 *
 * Deliberate choices:
 *   - Split inserts preserve the original `shift_id` and `created_by` — the
 *     surviving rows are the same assignment, not a new one, so ownership
 *     must not silently transfer to the acting admin.
 *   - Rows owned by another employee are never touched: the assignment
 *     selection and both cell clears are scoped by `user_id`.
 *   - The whole write runs in one transaction, so a partial clear can never
 *     be observed.
 *
 * Contract: tuple convention `{ success: true, ...counts }` /
 * `{ success: false, error }`; errors folded via `mapDbError`. A window
 * with nothing clearable is a SUCCESS with `totalCleared: 0` so the client
 * can show an info toast rather than an error.
 */
export type ClearWeekResult =
  | {
      success: true;
      affectedUserId: string;
      weekStart: string;
      weekEnd: string;
      deletedAssignments: number;
      trimmedAssignments: number;
      splitAssignments: number;
      clearedOverrides: number;
      clearedDayOffs: number;
      totalCleared: number;
    }
  | {
      success: false;
      error: 'internal';
    };

export const clearWeekFn = createServerFn({ method: 'POST' })
  .validator(clearWeekSchema)
  .handler(async ({ data }: { data: ClearWeekInput }): Promise<ClearWeekResult> => {
    const session = await requirePermission('attendance_admin', 'delete');
    await checkRateLimit(`write:${session.user.id}`);

    const weekStart = data.weekStart;
    const weekEnd = addDays(weekStart, 6);

    try {
      const result = await db.transaction(async (tx) => {
        // 1) Overrides + day offs for the 7 days — shared orphan-prevention
        //    guard, one call per day so the clear can never leave a masked
        //    sibling row behind.
        let clearedOverrides = 0;
        let clearedDayOffs = 0;
        for (const date of weekDays(weekStart)) {
          const removed = await clearCellTx(tx, { userId: data.userId, date });
          clearedOverrides += removed.deletedOverrides;
          clearedDayOffs += removed.deletedDayOffs;
        }

        // 2) Assignment coverage overlapping the window. Valid ranges only —
        //    a pre-existing inverted row resolves to nothing, so there is
        //    nothing for this action to clear there.
        const overlapping = await tx
          .select()
          .from(scheduleAssignments)
          .where(
            and(
              eq(scheduleAssignments.user_id, data.userId),
              lte(scheduleAssignments.effective_from, weekEnd),
              gte(scheduleAssignments.effective_to, weekStart),
              scheduleAssignmentRangeValid()
            )
          );

        let deletedAssignments = 0;
        let trimmedAssignments = 0;
        let splitAssignments = 0;

        for (const row of overlapping) {
          const plan = planClearAssignmentRange({
            effectiveFrom: row.effective_from,
            effectiveTo: row.effective_to,
            weekStart,
            weekEnd
          });

          switch (plan.kind) {
            case 'none':
              break;
            case 'delete': {
              await tx.delete(scheduleAssignments).where(eq(scheduleAssignments.id, row.id));
              deletedAssignments += 1;
              break;
            }
            case 'trimStart': {
              await tx
                .update(scheduleAssignments)
                .set({ effective_from: plan.remainingFrom, updated_at: new Date() })
                .where(eq(scheduleAssignments.id, row.id));
              trimmedAssignments += 1;
              break;
            }
            case 'trimEnd': {
              await tx
                .update(scheduleAssignments)
                .set({ effective_to: plan.remainingTo, updated_at: new Date() })
                .where(eq(scheduleAssignments.id, row.id));
              trimmedAssignments += 1;
              break;
            }
            case 'split': {
              // Keep the head on the existing row, then re-create the tail
              // with the original shift + creator so ownership survives.
              await tx
                .update(scheduleAssignments)
                .set({ effective_to: plan.leftTo, updated_at: new Date() })
                .where(eq(scheduleAssignments.id, row.id));
              await tx.insert(scheduleAssignments).values({
                user_id: row.user_id,
                shift_id: row.shift_id,
                effective_from: plan.rightFrom,
                effective_to: row.effective_to,
                created_by: row.created_by
              });
              splitAssignments += 1;
              break;
            }
          }
        }

        return {
          deletedAssignments,
          trimmedAssignments,
          splitAssignments,
          clearedOverrides,
          clearedDayOffs
        };
      });

      return {
        success: true as const,
        affectedUserId: data.userId,
        weekStart,
        weekEnd,
        ...result,
        totalCleared:
          result.deletedAssignments +
          result.trimmedAssignments +
          result.splitAssignments +
          result.clearedOverrides +
          result.clearedDayOffs
      };
    } catch (error) {
      mapDbError(error, 'scheduleGrid.clearWeek');
      return { success: false as const, error: 'internal' as const };
    }
  });
