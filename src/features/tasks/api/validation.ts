import { z } from 'zod';

export const taskIdSchema = z.object({
  taskId: z.number().int().positive()
});

export const availableTasksSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});
