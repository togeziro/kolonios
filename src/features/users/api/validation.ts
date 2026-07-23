import { z } from 'zod';
import type { UserFilters, UserMutationPayload } from './types';

export const userFiltersSchema: z.ZodType<UserFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  roles: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional()
});

export const userIdSchema = z.coerce.number().int().positive();

export const userMutationSchema: z.ZodType<UserMutationPayload> = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  role: z.string().min(1),
  status: z.string().min(1)
});
