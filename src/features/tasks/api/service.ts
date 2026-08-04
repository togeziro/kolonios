import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { taskIdSchema, availableTasksSchema } from './validation';

export const getMyTasksFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('my_work', 'view');
  await checkRateLimit(`tasks:${session.user.id}`);
  const { getMyTasks } = await import('@/lib/db/tasks');
  return getMyTasks(session.user.id);
});

export const getAvailableTasksFn = createServerFn({ method: 'GET' })
  .validator(availableTasksSchema)
  .handler(async ({ data: filters }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`tasks:${session.user.id}`);
    const { getAvailableTasks } = await import('@/lib/db/tasks');
    return getAvailableTasks(session.user.id, filters);
  });

export const getTaskDetailFn = createServerFn({ method: 'GET' })
  .validator(taskIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('my_work', 'view');
    const { getTaskDetail } = await import('@/lib/db/tasks');
    return getTaskDetail(session.user.id, data.taskId);
  });

export const takeTaskFn = createServerFn({ method: 'POST' })
  .validator(taskIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('jobs', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { takeTask } = await import('@/lib/db/tasks');
    return takeTask(session.user.id, data.taskId);
  });

export const completeTaskFn = createServerFn({ method: 'POST' })
  .validator(taskIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('my_work', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { completeTask } = await import('@/lib/db/tasks');
    return completeTask(session.user.id, data.taskId);
  });
