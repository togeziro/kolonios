import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const moneySchema = z
  .union([
    z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Money must be a non-negative decimal'),
    z.number().finite().nonnegative()
  ])
  .transform((value) => (typeof value === 'number' ? value.toFixed(2) : Number(value).toFixed(2)));
const idSchema = z.number().int().positive();
const employeeIdSchema = z.string().trim().min(1);

export const salaryComponentSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  type: z.enum(['allowance', 'deduction']),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional()
});
export const salaryComponentIdSchema = z.object({ id: idSchema });
export const salaryComponentUpdateSchema = salaryComponentIdSchema.extend({
  values: salaryComponentSchema.partial()
});

const profileBase = z.object({ employeeId: employeeIdSchema });
export const employeePayrollProfileSchema = profileBase.extend({
  kind: z.enum(['assignment', 'component', 'tax', 'benefit', 'bank']),
  values: z.record(z.string(), z.unknown())
});
export const employeePayrollProfileReadSchema = profileBase;

export const payrollPeriodSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    periodStart: dateSchema,
    periodEnd: dateSchema,
    status: z.literal('draft').optional()
  })
  .refine((value) => value.periodStart <= value.periodEnd, {
    message: 'Period start must precede end'
  });
export const payrollPeriodIdSchema = z.object({ id: idSchema });
export const payrollPeriodFiltersSchema = z.object({
  status: z.enum(['draft', 'processing', 'ready_to_pay', 'paid', 'locked']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});
export const payrollRecordFiltersSchema = z
  .object({
    payrollPeriodId: idSchema.optional(),
    employeeId: employeeIdSchema.optional(),
    departmentId: idSchema.optional(),
    status: z.enum(['draft', 'processing', 'ready_to_pay', 'paid', 'locked']).optional(),
    scope: z.enum(['admin', 'employee']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
  .refine((value) => value.scope !== 'employee' || Boolean(value.employeeId), {
    message: 'Employee scope requires employeeId',
    path: ['employeeId']
  });
export const myPayslipFiltersSchema = z.object({
  payrollPeriodId: idSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});
export const payrollRecordIdSchema = z.object({ id: idSchema });
export const generatePayrollSchema = z.object({ payrollPeriodId: idSchema });
export const reportFiltersSchema = payrollRecordFiltersSchema.extend({
  format: z.enum(['json', 'csv']).optional()
});

export const profileValuesSchema = z.object({
  employeeId: employeeIdSchema,
  assignment: z
    .object({
      salaryType: z.enum(['monthly', 'daily', 'hourly']),
      amount: moneySchema,
      effectiveFrom: dateSchema,
      effectiveTo: dateSchema.nullish()
    })
    .optional(),
  component: z
    .object({
      assignmentId: idSchema,
      salaryComponentId: idSchema,
      amount: moneySchema,
      effectiveFrom: dateSchema,
      effectiveTo: dateSchema.nullish()
    })
    .optional(),
  tax: z
    .object({
      effectiveFrom: dateSchema,
      effectiveTo: dateSchema.nullish(),
      taxSettingId: idSchema.nullish(),
      taxIdentifier: z.string().max(100).nullish(),
      filingStatus: z.string().max(50).nullish()
    })
    .optional()
});
