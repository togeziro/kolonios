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
