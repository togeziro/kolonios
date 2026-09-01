/**
 * Wire types shared between the schedule-grid server fn, the React Query
 * factory, and the presentational components.
 */

export type ScheduleGridCell = {
  date: string;
  shiftId: number | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  lateToleranceMinutes: number | null;
  absenceCutoffMinutes: number | null;
  isDayOff: boolean;
  hasAssignment: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  /** True when the date is a holiday but the cell has no assignment either
   * (i.e. the employee never had a schedule that day). Computed in
   * `getScheduleGridFn` so ticket 02's popover can decide whether to show
   * a "holiday over no-assignment" hint vs. a working holiday. No ticket-01
   * UI reads it — included now to keep the wire shape stable for 02/03. */
  holidayOverUnassigned: boolean;
  dayOffReason: string | null;
  /** True when the cell has an assignment + a date_override / weekday rule
   * pointing at a shift, but `resolveEffectiveSchedule` returned null because
   * the effective shift has no `shift_policies` row (PR #109 made the policy
   * required and dropped the DEFAULT_SHIFT_POLICY fallback). The grid
   * currently renders such cells as the "—" placeholder. The popover reads
   * this flag to surface a "shift ini belum dikonfigurasi policy" warning
   * before any write — admin is GOD MODE and may still proceed. */
  policyMissing: boolean;
};

export type ScheduleGridRow = {
  userId: string;
  fullName: string;
  employeeCode: string;
  divisionId: number | null;
  divisionName: string;
  cells: ScheduleGridCell[];
  /** Shift template currently in effect on the most recent date in the week
   * (or null when the employee has no active assignment). Used by the row
   * header for the small "shift name" pill. */
  activeShiftName: string | null;
  /** True when at least one cell in the visible week resolves against an
   * active `schedule_assignments` row for the employee. Drives ticket 03's
   * "+ Assign Shift" row-header CTA: visible only when `false`. Computed
   * server-side so the grid never has to re-derive assignment presence
   * from `cells[]`. */
  hasAssignment: boolean;
};

export type ScheduleGridWeekHolidays = {
  /** Map of YYYY-MM-DD -> holiday name for the 7-day window. */
  byDate: Record<string, string>;
};

export type ScheduleGridFilters = {
  month: string;
  weekStart: string;
  divisionId?: string | null;
  query?: string | null;
  page?: number;
  pageSize?: number;
};

export type ScheduleGridResponse = {
  month: string;
  weekStart: string;
  weekEnd: string;
  rows: ScheduleGridRow[];
  total: number;
  page: number;
  pageSize: number;
  holidays: ScheduleGridWeekHolidays;
};
