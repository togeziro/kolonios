import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { payrollPeriods } from '@/lib/db/schema/payroll';
import {
  assertPayrollTransition,
  listPayrollPeriods,
  lockPayrollPeriod,
  withPayrollAuditTransaction
} from '@/lib/db/payroll';
import {
  payrollPeriodFiltersSchema,
  payrollPeriodIdSchema,
  payrollPeriodSchema
} from './validation';

export const createPayrollPeriodFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.period.create', entityType: 'payroll_period' },
      async (tx) => {
        const [row] = await tx
          .insert(payrollPeriods)
          .values({
            name: data.name,
            period_start: data.periodStart,
            period_end: data.periodEnd,
            payment_date: data.paymentDate,
            status: 'draft',
            created_by: session.user.id
          })
          .returning();
        if (!row)
          throw new DomainError('Failed to create payroll period.', 'PAYROLL_PERIOD_CREATE_FAILED');
        return row;
      }
    );
    return created;
  });

export const listPayrollPeriodsFn = createServerFn({ method: 'GET' })
  .validator(payrollPeriodFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'view');
    return listPayrollPeriods(data);
  });

async function transitionPayrollWithAudit(
  actorUserId: string,
  id: number,
  nextStatus: 'processing' | 'ready_to_pay' | 'paid' | 'locked',
  action: string
) {
  return withPayrollAuditTransaction(
    actorUserId,
    { action, entityType: 'payroll_period', entityId: id },
    async (tx) => {
      const period = await lockPayrollPeriod(tx, id);
      if (!period)
        throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
      assertPayrollTransition(period.status, nextStatus);
      const [row] = await tx
        .update(payrollPeriods)
        .set({
          status: nextStatus,
          processed_at: nextStatus === 'ready_to_pay' ? new Date() : period.processed_at,
          paid_at: nextStatus === 'paid' ? new Date() : period.paid_at,
          updated_at: new Date()
        })
        .where(and(eq(payrollPeriods.id, id), eq(payrollPeriods.status, period.status)))
        .returning();
      if (!row)
        throw new DomainError(
          'Payroll period changed during transition.',
          'PAYROLL_PERIOD_CHANGED'
        );
      return row;
    }
  );
}

export const approvePayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'approve');
    return transitionPayrollWithAudit(session.user.id, data.id, 'ready_to_pay', 'payroll.approve');
  });
export const markPayrollPaidFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'pay');
    await checkRateLimit(`payroll:payment:${session.user.id}`);
    return transitionPayrollWithAudit(session.user.id, data.id, 'paid', 'payroll.pay');
  });
export const lockPayrollFn = createServerFn({ method: 'POST' })
  .validator(payrollPeriodIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return transitionPayrollWithAudit(session.user.id, data.id, 'locked', 'payroll.lock');
  });
