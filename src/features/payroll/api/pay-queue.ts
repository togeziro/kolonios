import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { getPayQueue, stampPayrollRecords } from '@/lib/db/payroll';
import { payQueueFiltersSchema, payQueueSelectionSchema } from './validation';

export const getPayQueueFn = createServerFn({ method: 'GET' })
  .validator(payQueueFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'view');
    return getPayQueue({ departmentId: data.departmentId });
  });

export const payPayQueueSelectionFn = createServerFn({ method: 'POST' })
  .validator(payQueueSelectionSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'pay');
    await checkRateLimit(`payroll:payment:${session.user.id}`);
    return stampPayrollRecords(data.recordIds, session.user.id);
  });
