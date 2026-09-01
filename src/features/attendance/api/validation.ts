import { z } from 'zod';

const MAX_TEXT_LENGTH = 1000;

export const attendanceCheckInSchema = z.object({
  shiftId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().positive().optional(),
  capturedAt: z.number().int().positive().optional(),
  lateDuration: z.number().min(0).optional(),
  photo: z.string().optional(),
  note: z.string().max(500).optional()
});

export const attendanceCheckOutSchema = z.object({
  attendanceId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().positive().optional(),
  capturedAt: z.number().int().positive().optional(),
  earlyOutDuration: z.number().min(0).optional(),
  photo: z.string().optional(),
  note: z.string().max(500).optional()
});

export const attendanceFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().positive().optional(),
  status: z.string().optional()
});

export const dateParamSchema = z.string().optional();

export const leaveTypeSchema = z.enum([
  'annual',
  'sick',
  'personal',
  'emergency',
  'maternity',
  'paternity'
]);

export const leaveStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export const leaveRequestSchema = z.object({
  leaveType: leaveTypeSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().max(MAX_TEXT_LENGTH).optional(),
  file: z.string().optional()
});

export const leaveFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: leaveStatusSchema.optional(),
  leaveType: leaveTypeSchema.optional()
});

// --- Schedule and policy validation schemas ---

const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM format');

export const weekdayScheduleRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isWorkingDay: z.boolean().optional(),
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional()
});

// Shared shape of a shift for both create and update. Create makes every
// field required; update makes them optional and adds `id` + `status`.
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use hex #RRGGBB')
  .nullable()
  .optional();

const breakWindow = {
  breakStart: timeString.nullable().optional(),
  breakEnd: timeString.nullable().optional(),
  maxBreakMinutes: z.number().int().nonnegative().nullable().optional()
};

const toleranceFields = {
  lateToleranceMinutes: z.number().int().nonnegative().optional(),
  absenceCutoffMinutes: z.number().int().nonnegative().optional()
};

const baseShiftFields = {
  name: z.string().min(1).max(200),
  startTime: timeString,
  endTime: timeString,
  type: z.enum(['fixed', 'flexible']).optional(),
  color: hexColor,
  note: z.string().max(MAX_TEXT_LENGTH).nullable().optional(),
  ...breakWindow,
  ...toleranceFields,
  weekdayRules: z.array(weekdayScheduleRuleSchema).optional()
};

function validateShiftShape(
  v: {
    breakStart?: string | null;
    breakEnd?: string | null;
    maxBreakMinutes?: number | null;
    weekdayRules?: Array<{
      dayOfWeek: number;
      isWorkingDay?: boolean;
      startTime?: string | null;
      endTime?: string | null;
    }>;
    startTime?: string;
    endTime?: string;
  },
  ctx: z.RefinementCtx,
  requireMaxBreak: boolean
) {
  const hasBreakStart = v.breakStart != null && v.breakStart !== '';
  const hasBreakEnd = v.breakEnd != null && v.breakEnd !== '';
  if (hasBreakStart !== hasBreakEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'breakStart and breakEnd must both be set or both be empty',
      path: ['breakStart']
    });
  }
  if (requireMaxBreak && hasBreakStart && hasBreakEnd && v.maxBreakMinutes == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxBreakMinutes is required when a break window is set',
      path: ['maxBreakMinutes']
    });
  }
  if (v.weekdayRules) {
    v.weekdayRules.forEach((r, i) => {
      if (r.isWorkingDay) {
        const start = r.startTime ?? v.startTime;
        const end = r.endTime ?? v.endTime;
        if (!start || !end) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Working days require startTime and endTime',
            path: ['weekdayRules', i]
          });
        }
      }
    });
  }
}

export const shiftCreateSchema = z
  .object(baseShiftFields)
  .superRefine((v, ctx) => validateShiftShape(v, ctx, true));

export const shiftUpdateSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(200).optional(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    type: z.enum(['fixed', 'flexible']).optional(),
    color: hexColor,
    note: z.string().max(MAX_TEXT_LENGTH).nullable().optional(),
    ...breakWindow,
    ...toleranceFields,
    status: z.enum(['active', 'inactive']).optional(),
    weekdayRules: z.array(weekdayScheduleRuleSchema).optional()
  })
  .superRefine((v, ctx) => validateShiftShape(v, ctx, false));

export const shiftDeleteSchema = z.object({
  id: z.number().int().positive()
});

export const scheduleAssignmentSchema = z.object({
  userId: z.string().min(1),
  shiftId: z.number().int().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
});

export const dateOverrideSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftId: z.number().int().positive()
});

export const dayOffSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const locationPolicySchema = z.object({
  gpsValidationEnabled: z.boolean(),
  selfieRequired: z.boolean(),
  maxAccuracyMeters: z.number().positive(),
  maxStaleMs: z.number().positive()
});

export const schedulePolicyOverrideSchema = z.object({
  gpsValidationEnabled: z.boolean().nullable(),
  selfieRequired: z.boolean().nullable(),
  maxAccuracyMeters: z.number().positive().nullable(),
  maxStaleMs: z.number().positive().nullable()
});

export const correctionReasonSchema = z.string().min(1).max(MAX_TEXT_LENGTH);

// --- Location management ---

export const locationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(MAX_TEXT_LENGTH).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().positive().optional(),
  gpsValidationEnabled: z.boolean().optional(),
  selfieRequired: z.boolean().optional(),
  maxAccuracyMeters: z.number().positive().optional(),
  maxStaleMs: z.number().positive().optional()
});

export const locationUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(MAX_TEXT_LENGTH).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().positive().optional(),
  gpsValidationEnabled: z.boolean().optional(),
  selfieRequired: z.boolean().optional(),
  maxAccuracyMeters: z.number().positive().optional(),
  maxStaleMs: z.number().positive().optional()
});

export const locationDeleteSchema = z.object({
  id: z.number().int().positive()
});

// --- Schedule management ---
// Replaced by shiftCreateSchema / shiftUpdateSchema / shiftDeleteSchema
// (admin shift master CRUD, see top of file).

// --- Assignments ---

export const assignmentFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  userId: z.string().optional(),
  shiftId: z.coerce.number().int().positive().optional()
});

export const bulkAssignmentSchema = z.object({
  assignments: z.array(scheduleAssignmentSchema).min(1, 'At least one assignment is required')
});

// --- Day off ---

export const dayOffDeleteSchema = z.object({
  id: z.number().int().positive()
});

// --- Corrections ---

export const correctionRequestSchema = z
  .object({
    attendanceId: z.number().int().positive(),
    requestedCheckInTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional(),
    requestedCheckOutTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .optional(),
    note: z.string().max(MAX_TEXT_LENGTH).optional()
  })
  .refine((v) => v.requestedCheckInTime || v.requestedCheckOutTime || v.note, {
    message: 'Provide a requested time or a note'
  });

export const correctionReviewSchema = z.object({
  attendanceId: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: correctionReasonSchema
});

// --- Reports ---

export const reportFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  userId: z.string().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  shiftId: z.coerce.number().int().positive().optional(),
  status: z.enum(['present', 'late', 'absent', 'excused', 'pending']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'pdf']);

export const exportReportSchema = z.object({
  filters: reportFiltersSchema,
  format: exportFormatSchema
});
