import { z } from 'zod';

export const monthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM')
});

export type MonthParamInput = z.infer<typeof monthParamSchema>;
