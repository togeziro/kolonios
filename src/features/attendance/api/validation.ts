import { z } from 'zod';

export const attendanceCheckInSchema = z.object({
  shiftId: z.number().int().positive().optional(),
  locationId: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lateDuration: z.number().min(0).optional(),
  photo: z.string().optional(),
  note: z.string().max(500).optional()
});

export const attendanceCheckOutSchema = z.object({
  attendanceId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
  reason: z.string().max(1000).optional(),
  file: z.string().optional()
});

export const leaveFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: leaveStatusSchema.optional(),
  leaveType: leaveTypeSchema.optional()
});
