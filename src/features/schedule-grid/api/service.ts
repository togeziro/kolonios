import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { db } from '@/lib/db';
import { departments } from '@/lib/db/schema/masterdata';
import { scheduleAssignments } from '@/lib/db/schema/attendance';
import { employees } from '@/lib/db/schema/employees';
import { resolveScheduleGridCells } from './cell-resolver';
import {
  SCHEDULE_GRID_MAX_PAGE_SIZE,
  scheduleGridFiltersSchema,
  assignShiftInlineSchema
} from './validation';
import type { ScheduleGridCell, ScheduleGridResponse, ScheduleGridRow } from './types';
import type { ScheduleGridFiltersInput, AssignShiftInlineInput } from './validation';
import { addDays, weekDays } from '../utils/date-utils';

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
    await requirePermission('attendance_admin', 'edit');

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

    const userIds = employeeRows.map((e) => e.id);

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
 *   - Auto-closes any pre-existing open-ended assignment
 *     (`effective_to IS NULL`) for the same user by setting
 *     `effective_to = effectiveFrom - 1 day` (admin is GOD MODE — no 422).
 *   - Wraps the close + insert in a single DB transaction so a partial
 *     state can never be observed.
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
    const session = await requirePermission('attendance_admin', 'edit');
    await checkRateLimit(`write:${session.user.id}`);

    if (data.effectiveTo && data.effectiveTo <= data.effectiveFrom) {
      return {
        success: false as const,
        error: 'effectiveToBeforeFrom' as const
      };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const openEnded = await tx
          .select()
          .from(scheduleAssignments)
          .where(
            and(
              eq(scheduleAssignments.user_id, data.userId),
              isNull(scheduleAssignments.effective_to)
            )
          )
          .orderBy(desc(scheduleAssignments.effective_from))
          .limit(1);

        let closedAssignment: typeof scheduleAssignments.$inferSelect | null = null;
        if (openEnded[0]) {
          const closingDate = addDays(data.effectiveFrom, -1);
          const [updated] = await tx
            .update(scheduleAssignments)
            .set({ effective_to: closingDate, updated_at: new Date() })
            .where(eq(scheduleAssignments.id, openEnded[0].id))
            .returning();
          closedAssignment = updated ?? null;
        }

        const [assignment] = await tx
          .insert(scheduleAssignments)
          .values({
            user_id: data.userId,
            shift_id: data.shiftId,
            effective_from: data.effectiveFrom,
            effective_to: data.effectiveTo ?? null,
            created_by: session.user.id
          })
          .returning();

        return { assignment, closedAssignment };
      });

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
