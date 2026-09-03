import { createServerFn } from '@tanstack/react-start';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { mapDbError } from '@/lib/errors';
import { db } from '@/lib/db';
import { getHolidaysInRange } from '@/lib/db/attendance';
import { departments } from '@/lib/db/schema/masterdata';
import {
  dateOverrides,
  dayOffs,
  scheduleAssignments,
  shifts,
  shiftWeekdayRules
} from '@/lib/db/schema/attendance';
import { employees } from '@/lib/db/schema/employees';
import {
  resolveEffectiveSchedule,
  type DateOverride as EngineDateOverride,
  type ScheduleAssignment as EngineAssignment,
  type ShiftPolicy,
  type WeekdayScheduleRule
} from '@/lib/attendance/schedule';
import {
  SCHEDULE_GRID_MAX_PAGE_SIZE,
  scheduleGridFiltersSchema,
  assignShiftInlineSchema
} from './validation';
import type { ScheduleGridCell, ScheduleGridResponse, ScheduleGridRow } from './types';
import type { ScheduleGridFiltersInput, AssignShiftInlineInput } from './validation';
import { addDays, dayOfWeek } from '../utils/date-utils';

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
 * Resolve one 7-day window for a set of employees with a single batched
 * query pass (assignments, date overrides, day offs, distinct shifts,
 * weekday rules, holidays) — no N+1. Returns both the wire rows and the
 * holiday-by-date map so `getScheduleGridFn` keeps its response shape while
 * the month export reuses the exact same engine (`resolveEffectiveSchedule`).
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
  const userIds = employeeRows.map((e) => e.id);

  // Assignments, weekday rules, shift policies — only meaningful when
  // there are employees to resolve. Skipped otherwise.
  let assignmentRows: (typeof scheduleAssignments.$inferSelect)[] = [];
  let overrideRows: (typeof dateOverrides.$inferSelect)[] = [];
  let dayOffRows: (typeof dayOffs.$inferSelect)[] = [];
  let weekdayRuleRows: (typeof shiftWeekdayRules.$inferSelect)[] = [];
  let shiftRows: (typeof shifts.$inferSelect)[] = [];

  if (userIds.length > 0) {
    const employeeInClause = inArray(scheduleAssignments.user_id, userIds);
    const assignmentWhere = and(
      employeeInClause,
      lte(scheduleAssignments.effective_from, weekEnd),
      or(
        sql`${scheduleAssignments.effective_to} IS NULL`,
        gte(scheduleAssignments.effective_to, weekStart)
      )
    );

    const [assignmentResult, overrideResult, dayOffResult] = await Promise.all([
      db
        .select()
        .from(scheduleAssignments)
        .where(assignmentWhere)
        .orderBy(desc(scheduleAssignments.effective_from)),
      db
        .select()
        .from(dateOverrides)
        .where(
          and(
            inArray(dateOverrides.user_id, userIds),
            gte(dateOverrides.date, weekStart),
            lte(dateOverrides.date, weekEnd)
          )
        ),
      db
        .select()
        .from(dayOffs)
        .where(
          and(
            inArray(dayOffs.user_id, userIds),
            gte(dayOffs.date, weekStart),
            lte(dayOffs.date, weekEnd)
          )
        )
    ]);

    assignmentRows = assignmentResult;
    overrideRows = overrideResult;
    dayOffRows = dayOffResult;

    // Distinct shift IDs across both assignments and overrides (overrides
    // can reference a shift the employee isn't currently assigned to).
    const distinctShiftIds = Array.from(
      new Set([...assignmentRows.map((a) => a.shift_id), ...overrideRows.map((o) => o.shift_id)])
    );

    if (distinctShiftIds.length > 0) {
      const [ruleResult, shiftResult] = await Promise.all([
        db
          .select()
          .from(shiftWeekdayRules)
          .where(inArray(shiftWeekdayRules.shift_id, distinctShiftIds)),
        db.select().from(shifts).where(inArray(shifts.id, distinctShiftIds))
      ]);
      weekdayRuleRows = ruleResult;
      shiftRows = shiftResult;
    }
  }

  // Group related rows by employee + shift for O(1) resolution.
  const assignmentsByUser = new Map<string, (typeof scheduleAssignments.$inferSelect)[]>();
  for (const a of assignmentRows) {
    const list = assignmentsByUser.get(a.user_id) ?? [];
    list.push(a);
    assignmentsByUser.set(a.user_id, list);
  }

  const overridesByUser = new Map<string, (typeof dateOverrides.$inferSelect)[]>();
  for (const o of overrideRows) {
    const list = overridesByUser.get(o.user_id) ?? [];
    list.push(o);
    overridesByUser.set(o.user_id, list);
  }

  const dayOffsByUser = new Map<string, (typeof dayOffs.$inferSelect)[]>();
  for (const d of dayOffRows) {
    const list = dayOffsByUser.get(d.user_id) ?? [];
    list.push(d);
    dayOffsByUser.set(d.user_id, list);
  }

  const rulesByShift = new Map<number, WeekdayScheduleRule[]>();
  for (const r of weekdayRuleRows) {
    const list = rulesByShift.get(r.shift_id) ?? [];
    list.push({
      dayOfWeek: r.day_of_week,
      isWorkingDay: r.is_working_day ?? true,
      startTime: r.start_time,
      endTime: r.end_time
    });
    rulesByShift.set(r.shift_id, list);
  }

  const shiftById = new Map<number, typeof shifts.$inferSelect>(shiftRows.map((s) => [s.id, s]));

  const policiesByShift = new Map<number, ShiftPolicy>();
  for (const s of shiftRows) {
    policiesByShift.set(s.id, {
      shiftId: s.id,
      lateToleranceMinutes: s.late_tolerance_minutes,
      absenceCutoffMinutes: s.absence_cutoff_minutes
    });
  }

  // Holidays for the week — single helper call.
  const holidayRows = await getHolidaysInRange(weekStart, weekEnd);
  const holidaysByDate: Record<string, string> = {};
  for (const h of holidayRows) {
    // Project recurring holidays onto the current week's year so the
    // header badge shows the date the holiday actually lands on inside
    // the visible window (e.g. recurring Aug 21 appears on 2026-08-21,
    // not on its stored 1999-08-21).
    if (h.isRecurring) {
      const mmdd = h.date.slice(5, 10); // 'MM-DD'
      for (let i = 0; i < 7; i += 1) {
        const candidate = addDays(weekStart, i).slice(0, 10);
        if (candidate.endsWith(mmdd)) {
          holidaysByDate[candidate] = h.name;
        }
      }
    } else if (h.date >= weekStart && h.date <= weekEnd) {
      holidaysByDate[h.date] = h.name;
    }
  }

  // Build the rows.
  const rows: ScheduleGridRow[] = employeeRows.map((employee) => {
    const userAssignments = assignmentsByUser.get(employee.id) ?? [];
    const userOverrides = overridesByUser.get(employee.id) ?? [];
    const userDayOffs = dayOffsByUser.get(employee.id) ?? [];
    const overrideDates: EngineDateOverride[] = userOverrides.map((o) => ({
      date: o.date,
      shiftId: o.shift_id
    }));
    const dayOffDates = userDayOffs.map((d) => d.date);
    const dayOffReasonsByDate = new Map(userDayOffs.map((d) => [d.date, d.reason ?? null]));

    const cells: ScheduleGridCell[] = [];
    let activeShiftName: string | null = null;

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(weekStart, i);
      // Pick the most recent assignment whose range covers this date.
      const matching = userAssignments.find(
        (a) => a.effective_from <= date && (a.effective_to == null || a.effective_to >= date)
      );
      const assignment: EngineAssignment | null = matching
        ? {
            userId: matching.user_id,
            shiftId: matching.shift_id,
            effectiveFrom: matching.effective_from,
            effectiveTo: matching.effective_to
          }
        : null;

      const weekdayRules = assignment ? (rulesByShift.get(assignment.shiftId) ?? []) : [];
      const shiftPolicies = assignment
        ? (() => {
            const ids = new Set<number>([assignment.shiftId]);
            for (const o of userOverrides) {
              if (o.date === date) ids.add(o.shift_id);
            }
            const out: ShiftPolicy[] = [];
            for (const id of ids) {
              const p = policiesByShift.get(id);
              if (p) out.push(p);
            }
            return out;
          })()
        : [];

      const resolved = resolveEffectiveSchedule({
        assignment,
        weekdayRules,
        shiftPolicies,
        dateOverrides: overrideDates,
        dayOffs: dayOffDates,
        date
      });

      const holidayName = holidaysByDate[date] ?? null;
      const isHoliday = holidayName != null;
      const hasAssignment = assignment != null;
      const isDayOff = hasAssignment && dayOffDates.includes(date);
      const dayOffReason = isDayOff ? (dayOffReasonsByDate.get(date) ?? null) : null;

      // Track the active shift name from the latest assignment whose range
      // overlaps the week — used for the row header pill.
      if (matching && activeShiftName == null) {
        const shift = shiftById.get(matching.shift_id);
        activeShiftName = shift?.name ?? null;
      }

      cells.push({
        date,
        shiftId: resolved?.shiftId ?? null,
        shiftName: resolved ? (shiftById.get(resolved.shiftId)?.name ?? null) : null,
        startTime: resolved?.startTime ?? null,
        endTime: resolved?.endTime ?? null,
        lateToleranceMinutes: resolved?.lateToleranceMinutes ?? null,
        absenceCutoffMinutes: resolved?.absenceCutoffMinutes ?? null,
        isDayOff,
        hasAssignment,
        isHoliday,
        holidayName,
        holidayOverUnassigned: !hasAssignment && isHoliday,
        dayOffReason,
        // Engine delta (PR #109): resolveEffectiveSchedule now returns null
        // when the effective shift has no `shift_policies` row (no
        // DEFAULT_SHIFT_POLICY fallback). Surface that as `policyMissing`
        // so the ticket-02 popover can warn the admin before any write.
        policyMissing: (() => {
          if (!hasAssignment || isDayOff || resolved != null) return false;
          // `effectiveShiftId` mirrors the engine's precedence: date
          // override > assignment.
          const override = overrideDates.find((o) => o.date === date);
          const effectiveShiftId = override?.shiftId ?? assignment!.shiftId;
          const rule = (rulesByShift.get(effectiveShiftId) ?? []).find(
            (r) => r.dayOfWeek === dayOfWeek(date)
          );
          if (!rule || !rule.isWorkingDay) return false;
          return policiesByShift.get(effectiveShiftId) == null;
        })()
      });
    }

    return {
      userId: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      divisionId: employee.departmentId,
      divisionName:
        employee.departmentId != null ? (deptNameById.get(employee.departmentId) ?? '') : '',
      cells,
      activeShiftName,
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
    } catch (e) {
      // mapDbError logs + throws a DomainError; the client wraps the call
      // in try/catch and surfaces errorGeneric. We don't return a tuple
      // here because `mapDbError`'s return type is `never`.
      mapDbError(e, 'scheduleGrid.createAssignmentInline');
    }
  });
