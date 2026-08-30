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

export const submitChecklistSchema = z.object({
  checklistId: z.number().int().positive()
});

export const updateChecklistStatusSchema = z
  .object({
    checklistId: z.number().int().positive(),
    status: z.enum(['approved', 'rejected']),
    rejectedReason: z.string().trim().max(2000).optional()
  })
  .refine((v) => v.status !== 'approved' || !v.rejectedReason, {
    message: 'rejectedReason only allowed when rejecting',
    path: ['rejectedReason']
  });

export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type SetGlobalNoteInput = z.infer<typeof setGlobalNoteSchema>;
export type UpdateChecklistStatusInput = z.infer<typeof updateChecklistStatusSchema>;
