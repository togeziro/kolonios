import { z } from 'zod';
import type { AddTaskPayload, MoveTaskPayload } from './types';

export const addTaskSchema: z.ZodType<AddTaskPayload> = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional()
});

export const moveTaskSchema: z.ZodType<MoveTaskPayload> = z.object({
  taskId: z.number().int().positive('taskId must be a positive number'),
  columnSlug: z.string().min(1, 'columnSlug is required'),
  position: z.number().int().nonnegative('position must be a non-negative integer')
});
