import { z } from 'zod';

export const updateAppLocaleSchema = z.object({
  locale: z.enum(['id-ID', 'en-US'])
});

export type UpdateAppLocaleInput = z.infer<typeof updateAppLocaleSchema>;
