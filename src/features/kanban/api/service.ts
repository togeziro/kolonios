import { createServerFn } from '@tanstack/react-start';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireSession } from '@/lib/auth/session';
import { addTaskSchema, moveTaskSchema } from './validation';
import type { AddTaskPayload, MoveTaskPayload } from './types';

export const getBoardFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireSession();
  const { getBoard } = await import('@/lib/db/kanban');
  return getBoard();
});

export const addTaskFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(addTaskSchema))
  .handler(async ({ data }: { data: AddTaskPayload }) => {
    await requireSession();
    const { addTask } = await import('@/lib/db/kanban');
    return addTask(data.title, data.description);
  });

export const moveTaskFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(moveTaskSchema))
  .handler(async ({ data }: { data: MoveTaskPayload }) => {
    await requireSession();
    const { moveTask } = await import('@/lib/db/kanban');
    return moveTask(data.taskId, data.columnSlug, data.position);
  });
