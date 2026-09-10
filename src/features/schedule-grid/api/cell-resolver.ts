/**
 * Schedule-grid cell resolution — the single owner of "given a set of users
 * and a date window, resolve the `ScheduleGridCell` for each (user, date)".
 *
 * Both adapters compose through here instead of each re-deriving the
 * "load raw schedule data → call the engine → load holidays → build cell"
 * pipeline:
 *
 *  - the READ path (`resolveWeekForEmployees` in `service.ts`, reused by the
 *    month export) calls `resolveScheduleGridCells` over a 7-day window and
 *    adorns the resolved cells with employee / department data to build rows;
 *  - the WRITE path (`withCellWrite` in `write-service.ts`) re-resolves the
 *    single affected cell after a mutation via `resolveScheduleGridCell`,
 *    which is literally `resolveScheduleGridCells` at N=1 (one user, a
 *    one-day window).
 *
 * Because both go through one function, a precedence / cell-shape change is a
 * single edit, and the write-side re-resolve is provably identical to what a
 * fresh read returns — holiday handling included. (Before this module the
 * write path loaded holidays with a single-day `getHolidaysInRange(date, date)`
 * and skipped the read path's exact-day projection; since that helper matches
 * recurring holidays by MONTH, a recurring holiday could bleed onto the wrong
 * day of the same month. Routing both paths through the shared projection
 * below fixes that.)
 *
 * This is a composition layer only: it loads rows (DB) and calls the pure
 * `resolveEffectiveSchedule` engine — it never forks the engine's precedence
 * rules. It lives in `src/features/schedule-grid/api/` (not `src/lib/`)
 * because it composes a feature-level read and returns the feature's
 * `ScheduleGridCell` shape (ADR-0001: `src/lib/**` must not import from
 * `src/features/**`).
 */

import { and, desc, gte, inArray, lte, or, sql } from 'drizzle-orm';

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

import { addDays, dayOfWeek } from '../utils/date-utils';
import type { ScheduleGridCell } from './types';

/**
 * Per-user slice of a resolved window: one cell keyed by YYYY-MM-DD for each
 * requested date, plus the row-header "active shift" pill. `activeShiftName`
 * is the most recent overlapping assignment's shift name and — unlike
 * `cell.shiftName`, which is null on a day-off / non-working day — survives
 * across the whole window, so it cannot be recovered from `cells` alone.
 */
export type ResolvedUserWindow = {
  cells: Map<string, ScheduleGridCell>;
  activeShiftName: string | null;
};

export type ResolveScheduleGridCellsResult = {
  /** One entry per requested `userId` (always present, even with no data). */
  byUser: Map<string, ResolvedUserWindow>;
  /**
   * YYYY-MM-DD -> holiday name across the window. Recurring holidays are
   * projected onto the exact day they land on inside the window (the same
   * projection that stamps each cell's `holidayName`).
   */
  holidaysByDate: Record<string, string>;
};

/**
 * Resolve the schedule-grid cells for `userIds` across the inclusive window
 * `[startDate, endDate]` (YYYY-MM-DD). Batched to avoid N+1: one aggregate
 * query per table regardless of the number of users or days.
 *
 * A single day is just a degenerate window (`startDate === endDate`), which
 * is how the write-side re-resolve reuses this without paying a 7-day load.
 */
export async function resolveScheduleGridCells(args: {
  userIds: string[];
  startDate: string;
  endDate: string;
}): Promise<ResolveScheduleGridCellsResult> {
  const { userIds, startDate, endDate } = args;

  // Every requested day in the window, in calendar order. YYYY-MM-DD strings
  // compare lexicographically == chronologically, so the loop is safe.
  const windowDates: string[] = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    windowDates.push(d);
  }

  // Assignments, overrides, day offs, weekday rules, shift policies — only
  // meaningful when there are users to resolve. Skipped otherwise.
  let assignmentRows: (typeof scheduleAssignments.$inferSelect)[] = [];
  let overrideRows: (typeof dateOverrides.$inferSelect)[] = [];
  let dayOffRows: (typeof dayOffs.$inferSelect)[] = [];
  let weekdayRuleRows: (typeof shiftWeekdayRules.$inferSelect)[] = [];
  let shiftRows: (typeof shifts.$inferSelect)[] = [];

  if (userIds.length > 0) {
    const assignmentWhere = and(
      inArray(scheduleAssignments.user_id, userIds),
      lte(scheduleAssignments.effective_from, endDate),
      or(
        sql`${scheduleAssignments.effective_to} IS NULL`,
        gte(scheduleAssignments.effective_to, startDate)
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
            gte(dateOverrides.date, startDate),
            lte(dateOverrides.date, endDate)
          )
        ),
      db
        .select()
        .from(dayOffs)
        .where(
          and(
            inArray(dayOffs.user_id, userIds),
            gte(dayOffs.date, startDate),
            lte(dayOffs.date, endDate)
          )
        )
    ]);

    assignmentRows = assignmentResult;
    overrideRows = overrideResult;
    dayOffRows = dayOffResult;

    // Distinct shift IDs across both assignments and overrides (overrides can
    // reference a shift the employee isn't currently assigned to).
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

  // Holidays for the window — single helper call, then project recurring
  // holidays onto the exact day they land on inside the window (e.g. recurring
  // Aug 21 appears on 2026-08-21, not on its stored 1999-08-21, and never on
  // another August day just because the helper matched by month).
  const holidayRows = await getHolidaysInRange(startDate, endDate);
  const holidaysByDate: Record<string, string> = {};
  for (const h of holidayRows) {
    if (h.isRecurring) {
      const mmdd = h.date.slice(5, 10); // 'MM-DD'
      for (const candidate of windowDates) {
        if (candidate.endsWith(mmdd)) {
          holidaysByDate[candidate] = h.name;
        }
      }
    } else if (h.date >= startDate && h.date <= endDate) {
      holidaysByDate[h.date] = h.name;
    }
  }

  // Resolve every (user, date) cell.
  const byUser = new Map<string, ResolvedUserWindow>();
  for (const userId of userIds) {
    const userAssignments = assignmentsByUser.get(userId) ?? [];
    const userOverrides = overridesByUser.get(userId) ?? [];
    const userDayOffs = dayOffsByUser.get(userId) ?? [];
    const overrideDates: EngineDateOverride[] = userOverrides.map((o) => ({
      date: o.date,
      shiftId: o.shift_id
    }));
    const dayOffDates = userDayOffs.map((d) => d.date);
    const dayOffReasonsByDate = new Map(userDayOffs.map((d) => [d.date, d.reason ?? null]));

    const cells = new Map<string, ScheduleGridCell>();
    let activeShiftName: string | null = null;

    for (const date of windowDates) {
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

      // Track the active shift name from the earliest (in calendar order)
      // assignment whose range overlaps the window — used for the row pill.
      if (matching && activeShiftName == null) {
        activeShiftName = shiftById.get(matching.shift_id)?.name ?? null;
      }

      cells.set(date, {
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
        // Engine delta (PR #109): resolveEffectiveSchedule returns null when
        // the effective shift has no `shift_policies` row (no
        // DEFAULT_SHIFT_POLICY fallback). Surface that as `policyMissing` so
        // the popover can warn the admin before any write.
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

    byUser.set(userId, { cells, activeShiftName });
  }

  return { byUser, holidaysByDate };
}

/**
 * Re-resolve a single (user, date) cell — the write path's post-mutation
 * refresh. This is `resolveScheduleGridCells` at N=1 (one user, a one-day
 * window), so the returned cell is byte-for-byte what the read path would
 * return for the same date. The two non-null assertions are total by the
 * resolver's contract: it emits an entry for every requested `userId` and a
 * cell for every date in the window, and here both sets are singletons.
 */
export async function resolveScheduleGridCell(
  userId: string,
  date: string
): Promise<ScheduleGridCell> {
  const { byUser } = await resolveScheduleGridCells({
    userIds: [userId],
    startDate: date,
    endDate: date
  });
  return byUser.get(userId)!.cells.get(date)!;
}
