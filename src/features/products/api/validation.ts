import { z } from 'zod';
import type { ProductFilters, ProductMutationPayload } from './types';

export const productFiltersSchema: z.ZodType<ProductFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  categories: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional()
});

export const productIdSchema = z.coerce.number().int().positive();

export const productMutationSchema: z.ZodType<ProductMutationPayload> = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.coerce.number().positive(),
  description: z.string().min(1)
});
