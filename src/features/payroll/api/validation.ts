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
  amount: moneySchema,
  mode: z.enum(['fixed', 'percentage', 'per-attendance']).default('fixed'),
  percentageBase: z.enum(['base-salary', 'gross-salary']).nullish(),
  attendanceMetric: z.enum(['payable-days', 'worked-hours', 'late-count']).nullish(),
  taxable: z.boolean().default(false)
});
const taxValuesSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  taxSettingId: idSchema.nullish(),
  taxIdentifier: z.string().max(100).nullish(),
  filingStatus: z.string().max(50).nullish(),
  employmentStatus: z.enum(['permanent', 'contract', 'freelance']).optional(),
  ptkpStatus: z.enum(['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3']).optional(),
  residency: z.enum(['resident', 'foreign']).optional(),
  taxFacility: z.enum(['none', 'dtp', 'etc']).optional(),
  taxObjectCode: z.enum(['21-100-01', '21-100-02', '21-100-32']).optional(),
  pph21Method: z.enum(['gross', 'gross_up']).nullish()
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
    paymentDate: dateSchema,
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
const manualAdjustmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['bonus', 'deduction']),
  amount: moneySchema,
  taxable: z.boolean().optional()
});
export const payrollRecordAdjustmentSchema = z.object({
  id: idSchema,
  adjustments: z.array(manualAdjustmentSchema).max(50)
});
export const reportFiltersSchema = payrollRecordFiltersSchema.extend({
  format: z.enum(['json', 'csv', 'xlsx']).default('json')
});

const jkkCategorySchema = z.enum(['very_low', 'low', 'medium', 'high', 'very_high']);

export const companyPayrollSettingsSchema = z.object({
  companyNpwp: z.string().max(100).optional(),
  cutOffDay: z.number().int().min(1).max(31).optional(),
  pph21Enabled: z.boolean().optional(),
  pph21Method: z.enum(['gross', 'gross_up']).optional(),
  jkkEnabled: z.boolean().optional(),
  jkmEnabled: z.boolean().optional(),
  jhtEnabled: z.boolean().optional(),
  jpEnabled: z.boolean().optional(),
  bpjsKesehatanEnabled: z.boolean().optional(),
  jkkRiskCategory: jkkCategorySchema.optional(),
  jkmCompanyRate: moneySchema.optional(),
  jhtCompanyRate: moneySchema.optional(),
  jhtEmployeeRate: moneySchema.optional(),
  jpCompanyRate: moneySchema.optional(),
  jpEmployeeRate: moneySchema.optional(),
  kesehatanCompanyRate: moneySchema.optional(),
  kesehatanEmployeeRate: moneySchema.optional(),
  potonganIzinJamDefault: moneySchema.optional(),
  potonganShortfallDefault: moneySchema.optional()
});

export const bpjsEnrollmentSchema = effectiveDatesSchema.extend({
  id: idSchema.optional(),
  employeeId: employeeIdSchema,
  program: z.enum(['jkk', 'jkm', 'jht', 'jp', 'kesehatan']),
  membershipNumber: z.string().max(100).optional(),
  registrationDate: dateSchema.nullish(),
  registeredWage: moneySchema,
  jkkCategoryOverride: jkkCategorySchema.nullish(),
  isActive: z.boolean().default(true)
});

export const bpjsFamilyMemberSchema = z.object({
  enrollmentId: idSchema,
  name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().min(1).max(100),
  birthDate: dateSchema.nullish(),
  isCore: z.boolean().default(true)
});
export const bpjsFamilyMemberIdSchema = z.object({ id: idSchema });

export const attendanceOverrideSchema = z.object({
  payrollPeriodId: idSchema,
  employeeId: employeeIdSchema,
  scheduledDays: z.number().finite().nonnegative().nullish(),
  payableDays: z.number().finite().nonnegative().nullish(),
  workedHours: z.number().finite().nonnegative().nullish(),
  permitHours: z.number().finite().nonnegative().nullish(),
  shortfallHours: z.number().finite().nonnegative().nullish()
});

export const taxRecordOverrideSchema = z.object({
  id: idSchema,
  amount: moneySchema
});
