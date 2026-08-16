import { z } from 'zod';

export const setWorklogSettingsSchema = z.object({
  lenient: z.boolean()
});

export type SetWorklogSettingsInput = z.infer<typeof setWorklogSettingsSchema>;
