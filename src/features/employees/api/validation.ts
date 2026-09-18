import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import type { EmployeeFilters, EmployeeMutationPayload, OnboardEmployeePayload } from './types';

export const EMPLOYEE_QUERY_LIMIT_MAX = 100;

export function isEmployeeQueryTruncated(
  total: number | undefined,
  limit = EMPLOYEE_QUERY_LIMIT_MAX
): boolean {
  return typeof total === 'number' && total > limit;
}

export const employeeFiltersSchema: z.ZodType<EmployeeFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(EMPLOYEE_QUERY_LIMIT_MAX).optional(),
  search: z.string().optional(),
  department_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

export const employeeIdSchema = z.string();

const employeeMutationBase = z.object({
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

export const employeeMutationSchema: z.ZodType<EmployeeMutationPayload> = employeeMutationBase;

/**
 * Blank password means "generate for me"; a provided value must meet the
 * minimum. (The DB re-checks and throws WEAK_PASSWORD — this is the early
 * RPC gate. Mirrors the users create path.)
 */
const optionalPasswordSchema = z
  .string()
  .optional()
  .refine((v) => v === undefined || v.trim() === '' || v.length >= MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  });

/**
 * Single-action onboarding: HR profile fields plus the account fields
 * (access level + optional initial password). Complete minimal = full name,
 * email, birth date, department, designation, join date.
 */
export const onboardEmployeeSchema: z.ZodType<OnboardEmployeePayload> = employeeMutationBase.extend(
  {
    role_group_id: z.string().optional(),
    password: optionalPasswordSchema
  }
);

/**
 * Form-level twin of the onboard schema: selects stay strings and the
 * password confirmation is checked here (never sent to the server).
 */
export const onboardFormSchema = z
  .object({
    full_name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email'),
    role_group_id: z.string().optional(),
    password: optionalPasswordSchema,
    confirmPassword: z.string().optional(),
    birth_date: z.string().min(1, 'Birth date is required'),
    department_id: z.string().min(1, 'Department is required'),
    designation_id: z.string().min(1, 'Designation is required'),
    join_date: z.string().min(1, 'Join date is required')
  })
  .superRefine((values, ctx) => {
    const provided = values.password?.trim() || values.confirmPassword?.trim();
    if (provided && values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match'
      });
    }
  });

export type OnboardFormValues = z.infer<typeof onboardFormSchema>;
