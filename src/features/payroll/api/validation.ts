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
const effectiveDatesSchema = z
  .object({
    effectiveFrom: dateSchema,
    effectiveTo: dateSchema.nullish()
  })
  .refine((value) => !value.effectiveTo || value.effectiveFrom <= value.effectiveTo, {
    message: 'Effective start must precede end'
  });

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
const assignmentValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  salaryType: z.enum(['monthly', 'daily', 'hourly']),
  amount: moneySchema,
  departmentId: idSchema.nullish(),
  designationId: idSchema.nullish()
});
const componentValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  assignmentId: idSchema,
  salaryComponentId: idSchema,
  amount: moneySchema
});
const taxValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  taxSettingId: idSchema.nullish(),
  taxIdentifier: z.string().max(100).nullish(),
  filingStatus: z.string().max(50).nullish()
});
const benefitValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  benefitCode: z.string().trim().min(1).max(50),
  benefitName: z.string().trim().min(1).max(200),
  amount: moneySchema.nullish(),
  status: z.enum(['active', 'inactive']).default('active')
});
const bankValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  bankName: z.string().trim().min(1).max(100),
  accountName: z.string().trim().min(1).max(200),
  accountNumber: z.string().trim().min(1).max(100),
  isPrimary: z.boolean().default(false)
});
export const employeePayrollProfileSchema = z.discriminatedUnion('kind', [
  profileBase.extend({ kind: z.literal('assignment'), values: assignmentValuesSchema }),
  profileBase.extend({ kind: z.literal('component'), values: componentValuesSchema }),
  profileBase.extend({ kind: z.literal('tax'), values: taxValuesSchema }),
  profileBase.extend({ kind: z.literal('benefit'), values: benefitValuesSchema }),
  profileBase.extend({ kind: z.literal('bank'), values: bankValuesSchema })
]);
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
  format: z.enum(['json', 'csv']).default('json')
});
