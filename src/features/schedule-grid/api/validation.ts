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
 * Note: the cross-field rule (`effectiveTo > effectiveFrom`) is NOT enforced
 * by zod — it lives in the server fn and surfaces as a tuple
 * `{ success: false, error: 'effectiveToBeforeFrom' }` so the dialog can
 * keep the field-level `required` markers per repo convention.
 */
export const assignShiftInlineSchema = z.object({
  userId: z.string().min(1),
  shiftId: z.number().int().positive(),
  effectiveFrom: ymd,
  effectiveTo: ymd.nullish()
});

export type AssignShiftInlineInput = z.infer<typeof assignShiftInlineSchema>;
