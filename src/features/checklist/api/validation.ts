import { z } from 'zod';

export const updateChecklistItemSchema = z
  .object({
    itemId: z.number().int().positive(),
    outcome: z.enum(['ok', 'issue', 'pending']).optional(),
    note: z.string().max(1000).optional(),
    photoKey: z.string().max(500).optional()
  })
  .refine(
    (v) => v.outcome !== undefined || v.note !== undefined || v.photoKey !== undefined,
    'At least one field must be provided'
  );

export const setGlobalNoteSchema = z.object({
  checklistId: z.number().int().positive(),
  note: z.string().max(2000)
});

export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type SetGlobalNoteInput = z.infer<typeof setGlobalNoteSchema>;
