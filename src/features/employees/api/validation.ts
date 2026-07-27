import { z } from 'zod';
import type { EmployeeFilters, EmployeeMutationPayload } from './types';

export const employeeFiltersSchema: z.ZodType<EmployeeFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  department_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

export const employeeIdSchema = z.string();

export const employeeMutationSchema: z.ZodType<EmployeeMutationPayload> = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  nickname: z.string().optional(),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  birth_place: z.string().optional(),
  birth_date: z.string().min(1, 'Birth date is required'),
  address: z.string().optional(),
  id_number: z.string().optional(),
  department_id: z.coerce.number().int().positive('Department is required'),
  designation_id: z.coerce.number().int().positive('Designation is required'),
  is_internship: z.coerce.boolean().optional(),
  employment_status: z.string().optional(),
  join_date: z.string().min(1, 'Join date is required'),
  leave_date: z.string().nullable().optional(),
  base_salary: z.coerce.number().min(0).optional(),
  status: z.string().optional()
});
