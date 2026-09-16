import { z } from 'zod';

export const setWorklogSettingsSchema = z.object({
  lenient: z.boolean()
});
