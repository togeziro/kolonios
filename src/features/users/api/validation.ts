import { z } from 'zod';
import type { UserFilters, UserMutationPayload } from './types';

export const userFiltersSchema: z.ZodType<UserFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  roles: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  status: z.string().optional()
});

export const userIdSchema = z.string();

export const userMutationSchema: z.ZodType<UserMutationPayload> = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
  role_group_id: z.string().optional(),
  status: z.string().min(1)
});
