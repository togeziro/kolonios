import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { payrollPeriods } from '@/lib/db/schema/payroll';
import {
  getAttendanceOverride,
  upsertAttendanceOverride,
  withPayrollAuditTransaction
} from '@/lib/db/payroll';
import { assertEmployeeScope } from './shared';
import { attendanceOverrideSchema } from './validation';

export const getAttendanceOverrideFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({ payrollPeriodId: z.number().int().positive(), employeeId: z.string().min(1) })
  )
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    return JSON.parse(
      JSON.stringify(await getAttendanceOverride(data.payrollPeriodId, data.employeeId))
    );
  });

export const upsertAttendanceOverrideFn = createServerFn({ method: 'POST' })
  .validator(attendanceOverrideSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const result = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.attendance_override.upsert',
        entityType: 'payroll_attendance_override',
        entityId: data.payrollPeriodId
      },
      async (tx) => {
        const period = await tx
          .select()
          .from(payrollPeriods)
          .where(eq(payrollPeriods.id, data.payrollPeriodId))
          .limit(1);
        if (!period[0])
          throw new DomainError('Payroll period was not found.', 'PAYROLL_PERIOD_NOT_FOUND');
        if (period[0].status !== 'draft' && period[0].status !== 'processing')
          throw new DomainError(
            'Attendance overrides require a draft or processing period.',
            'OVERRIDE_NOT_ALLOWED'
          );
        return upsertAttendanceOverride(
          data.payrollPeriodId,
          data.employeeId,
          {
            scheduled_days: data.scheduledDays != null ? String(data.scheduledDays) : undefined,
            payable_days: data.payableDays != null ? String(data.payableDays) : undefined,
            worked_hours: data.workedHours != null ? String(data.workedHours) : undefined,
            permit_hours: data.permitHours != null ? String(data.permitHours) : undefined,
            shortfall_hours: data.shortfallHours != null ? String(data.shortfallHours) : undefined
          },
          session.user.id
        );
      }
    );
    return result;
  });
