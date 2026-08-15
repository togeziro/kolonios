import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { monthParamSchema } from './validation';

export const getMyScheduleFn = createServerFn({ method: 'GET' })
  .validator(monthParamSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('schedule', 'view');
    const { getMonthlyScheduleData } = await import('@/lib/db/attendance');
    return getMonthlyScheduleData(session.user.id, data.month);
  });
