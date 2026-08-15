import { z } from 'zod';

export const monthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
});

export type MonthParamInput = z.infer<typeof monthParamSchema>;
