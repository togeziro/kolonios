import { z } from 'zod';

export const rateLimitSchema = z.object({
  max: z.number().int().min(10).max(10_000),
  windowMs: z.number().int().min(1000).max(3_600_000)
});

export type RateLimitInput = z.infer<typeof rateLimitSchema>;
