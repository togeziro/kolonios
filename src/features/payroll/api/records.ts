import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { employees } from '@/lib/db/schema/employees';
import { employeeTaxRecords, payrollPeriods, payrollRecords } from '@/lib/db/schema/payroll';
import {
  assertPayrollTransition,
  listPayrollRecords,
  lockPayrollPeriod,
  withPayrollAuditTransaction
} from '@/lib/db/payroll';
import { calculatePayroll, parseDbDecimalToMoney } from '../utils/calculator';
import type { PayrollCalculationInput } from './types';
import { assertEmployeeScope, recalculateSegmentsWithAdjustments } from './shared';
import { buildPayrollRecord } from './record-builder';
import {
  generatePayrollSchema,
  payrollRecordAdjustmentSchema,
  payrollRecordFiltersSchema
} from './validation';

export function resolvePayrollRecordScope(
  actor: { user: { id: string; role?: string | null } },
  filters: { scope?: 'admin' | 'employee'; employeeId?: string }
) {
  const staffRole = ['employee', 'technician', 'user'].includes(actor.user.role ?? '');
  if (staffRole) {
    if (filters.employeeId && filters.employeeId !== actor.user.id)
      assertEmployeeScope(actor, filters.employeeId);
    return { scope: 'employee' as const, employeeId: actor.user.id };
  }
  return {
    scope: filters.scope === 'employee' ? ('employee' as const) : ('admin' as const),
    employeeId: filters.scope === 'employee' ? actor.user.id : filters.employeeId
  };
}

export function assertPayrollAdjustmentAllowed(status: string) {
  if (status !== 'processing') {
    throw new DomainError(
      'Manual adjustments are only allowed before payroll approval.',
      'ADJUSTMENT_NOT_ALLOWED'
    );
  }
}

export const listPayrollRecordsFn = createServerFn({ method: 'GET' })
  .validator(payrollRecordFiltersSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    const scope = resolvePayrollRecordScope(session, data);
    return JSON.parse(
      JSON.stringify(
        await listPayrollRecords({
          payroll_period_id: data.payrollPeriodId,
          employee_id: scope.employeeId,
          department_id: data.departmentId,
          status: data.status,
          scope: scope.scope,
          page: data.page,
          limit: data.limit
        })
      )
    );
  });

export const generatePayrollFn = createServerFn({ method: 'POST' })
  .validator(generatePayrollSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    await checkRateLimit(`payroll:generate:${session.user.id}`);
    const generated = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.generate', entityType: 'payroll_period', entityId: data.payrollPeriodId },
      async (tx) => {
        const period = await lockPayrollPeriod(tx, data.payrollPeriodId);
        if (!period)
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
        assertPayrollTransition(period.status, 'processing');
        const activeEmployees = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.status, 'active'));
        const records = [];
        for (const employee of activeEmployees)
          records.push(await buildPayrollRecord(employee.id, period, tx));
        const created = [];
        for (const record of records) {
          const [duplicate] = await tx
            .select({ id: payrollRecords.id })
            .from(payrollRecords)
            .where(
              and(
                eq(payrollRecords.payroll_period_id, period.id),
                eq(payrollRecords.employee_id, record.employee_id)
              )
            )
            .limit(1);
          if (duplicate)
            throw new DomainError(
              'Duplicate payroll record for this employee and period.',
              'DUPLICATE_PAYROLL_RECORD'
            );
          const [row] = await tx.insert(payrollRecords).values(record).returning();
          if (!row)
            throw new DomainError(
              'Failed to create payroll record.',
              'PAYROLL_RECORD_CREATE_FAILED'
            );
          const resolvedSegments = record.details.resolvedSegments;
          if (resolvedSegments && resolvedSegments.length > 0) {
            const taxableIncome = resolvedSegments.reduce(
              (sum, segment) => sum + segment.result.tax.taxableIncome,
              0
            );
            const taxAmount = resolvedSegments.reduce(
              (sum, segment) => sum + segment.result.tax.amount,
              0
            );
            await tx.insert(employeeTaxRecords).values({
              employee_id: record.employee_id,
              payroll_record_id: row.id,
              tax_period: period.period_start,
              taxable_income: (taxableIncome / 100).toFixed(2),
              tax_amount: (taxAmount / 100).toFixed(2),
              source: 'calculated',
              is_overridden: false
            });
          }
          created.push(row);
        }
        const [updatedPeriod] = await tx
          .update(payrollPeriods)
          .set({ status: 'processing', updated_at: new Date() })
          .where(and(eq(payrollPeriods.id, period.id), eq(payrollPeriods.status, period.status)))
          .returning();
        if (!updatedPeriod)
          throw new DomainError(
            'Payroll period changed during generation.',
            'PAYROLL_PERIOD_CHANGED'
          );
        return created;
      }
    );
    return JSON.parse(JSON.stringify(generated));
  });

export const adjustPayrollRecordFn = createServerFn({ method: 'POST' })
  .validator(payrollRecordAdjustmentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.record.adjust', entityType: 'payroll_record', entityId: data.id },
      async (tx) => {
        const [record] = await tx
          .select()
          .from(payrollRecords)
          .where(eq(payrollRecords.id, data.id))
          .limit(1);
        if (!record)
          throw new DomainError('Payroll record was not found.', 'PAYROLL_RECORD_NOT_FOUND');
        const period = await lockPayrollPeriod(tx, record.payroll_period_id);
        if (!period)
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
        assertPayrollAdjustmentAllowed(period.status);
        const details =
          record.details && typeof record.details === 'object'
            ? (record.details as Record<string, unknown>)
            : null;
        const input = details?.input;
        if (!input || typeof input !== 'object')
          throw new DomainError(
            'Payroll calculation input is unavailable.',
            'MISSING_PAYROLL_DATA'
          );
        const adjustments = data.adjustments.map((adjustment) => ({
          ...adjustment,
          amount: parseDbDecimalToMoney(adjustment.amount)
        }));
        const existingSegments =
          details?.resolvedSegments && Array.isArray(details.resolvedSegments)
            ? (details.resolvedSegments as Array<{
                assignmentId: number;
                taxId: number;
                start: string;
                end: string;
                benefits: unknown;
                bank: unknown;
                employmentEvent: unknown;
              }>)
            : undefined;
        const existingEmploymentEvents = details?.employmentEvents as unknown[] | undefined;
        const result = Array.isArray(input)
          ? recalculateSegmentsWithAdjustments(
              input,
              adjustments,
              existingSegments,
              existingEmploymentEvents
            )
          : calculatePayroll({
              ...(input as PayrollCalculationInput),
              manualAdjustments: adjustments
            });
        const [updated] = await tx
          .update(payrollRecords)
          .set({
            gross_salary: (result.grossSalary / 100).toFixed(2),
            total_allowances: (result.allowanceTotal / 100).toFixed(2),
            total_deductions: (result.deductionTotal / 100).toFixed(2),
            net_salary: (result.netSalary / 100).toFixed(2),
            details: result.snapshot,
            updated_at: new Date()
          })
          .where(eq(payrollRecords.id, data.id))
          .returning();
        if (!updated)
          throw new DomainError(
            'Payroll record changed during adjustment.',
            'PAYROLL_RECORD_CHANGED'
          );
        return JSON.parse(JSON.stringify(updated));
      }
    );
  });
