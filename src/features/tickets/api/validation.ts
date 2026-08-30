import { z } from 'zod';
import type { TicketReviewDecision } from '@/lib/domain/tickets';

export const ticketIdSchema = z.object({
  ticketId: z.number().int().positive()
});

export const listOpenTicketsSchema = z.object({
  domain: z.enum(['field', 'backoffice']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

export const ticketLegInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional()
});

export const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  channel: z.enum(['whatsapp', 'phone', 'email', 'walk_in', 'field', 'others']).optional(),
  customerId: z.string().max(100).optional(),
  assetName: z.string().max(200).optional(),
  taskType: z
    .enum(['installation', 'maintenance', 'inspection', 'data', 'sales', 'others'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  dueAt: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  legs: z.array(ticketLegInputSchema).max(10).optional()
});

export const legIdSchema = z.object({
  legId: z.number().int().positive()
});

export const arriveTicketSchema = ticketIdSchema.extend({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).optional()
});

export const workSessionMaterialSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(999),
  unit: z.string().max(20),
  source: z.enum(['warehouse', 'van'])
});

export const workSessionPhotoSchema = z.object({
  fileUrl: z.string().min(1).max(500)
});

export const workSessionLogEntrySchema = z.object({
  kind: z.enum(['note', 'photo', 'location', 'meter']),
  body: z.string().min(1).max(500)
});

export const submitHandoffNoteSchema = z.object({
  legId: z.number().int().positive(),
  note: z.string().min(1).max(2000)
});

export const reviewTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  decision: z.enum(['approved', 'rejected']) satisfies z.ZodType<TicketReviewDecision>,
  notes: z.string().max(2000).optional()
});

export const submitWorkSessionSchema = z.object({
  ticketId: z.number().int().positive(),
  materials: z.array(workSessionMaterialSchema).max(20),
  photos: z.array(workSessionPhotoSchema).min(1).max(4),
  notes: z.string().max(2000),
  log: z.array(workSessionLogEntrySchema).max(50).default([])
});

export type WorkSessionSubmit = z.infer<typeof submitWorkSessionSchema>;
