import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/**
 * Maximum number of rows the client may request per page. Mirrored as the
 * ceiling in `getScheduleGridFn` so a client can't bypass the schema cap.
 */
export const SCHEDULE_GRID_MAX_PAGE_SIZE = 200;

export const scheduleGridFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM'),
  weekStart: ymd,
  divisionId: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(SCHEDULE_GRID_MAX_PAGE_SIZE).optional()
});

export type ScheduleGridFiltersInput = z.infer<typeof scheduleGridFiltersSchema>;

/**
 * Inline "Assign Shift" dialog payload (ticket 03). Mirrors the existing
 * `scheduleAssignmentSchema` in `src/features/attendance/api/validation.ts`
 * but lives here to keep the schedule-grid feature self-contained.
 *
 * Note: the required-`effectiveTo` rule (bounded assignments only) and the
 * cross-field rule (`effectiveTo > effectiveFrom`) are NOT enforced by zod —
 * they live in the server fn and surface as tuples
 * (`{ success: false, error: 'effectiveToRequired' | 'effectiveToBeforeFrom' }`)
 * so the dialog can keep field-level `required` markers per repo convention.
 */
export const assignShiftInlineSchema = z.object({
  userId: z.string().min(1),
  shiftId: z.number().int().positive(),
  effectiveFrom: ymd,
  effectiveTo: ymd.nullish()
});

export type AssignShiftInlineInput = z.infer<typeof assignShiftInlineSchema>;

/**
 * "Delete schedule" payload. The covering assignment is addressed by
 * `assignmentId` (taken straight off the resolved `ScheduleGridCell`), so the
 * write is exact even when two ranges overlap the same date — no re-deriving
 * "which row does the grid mean?" on the server. `userId` is both the
 * ownership guard and the scope for the post-delete cell re-resolve; `date`
 * is the day whose cell is re-resolved.
 */
export const deleteAssignmentSchema = z.object({
  userId: z.string().min(1),
  date: ymd,
  assignmentId: z.number().int().positive()
});

export type DeleteAssignmentInput = z.infer<typeof deleteAssignmentSchema>;

/**
 * "Clear week" payload — one employee × the currently displayed week. The
 * server derives the 7-day window from `weekStart` (inclusive, `+6` days), so
 * the client never sends a second date that could disagree with the grid.
 */
export const clearWeekSchema = z.object({
  userId: z.string().min(1),
  weekStart: ymd
});

export type ClearWeekInput = z.infer<typeof clearWeekSchema>;
