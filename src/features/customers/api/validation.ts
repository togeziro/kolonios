import { z } from 'zod';
import type { CustomerFilters, CustomerMutationPayload } from './types';

export const customerFiltersSchema: z.ZodType<CustomerFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

export const customerIdSchema = z.string();

export const customerMutationSchema: z.ZodType<CustomerMutationPayload> = z.object({
  id: z.string(),
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  id_card_number: z.string().optional(),
  id_card_photo: z.string().optional(),
  service_data: z.string().optional(),
  billing_address: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional()
});
