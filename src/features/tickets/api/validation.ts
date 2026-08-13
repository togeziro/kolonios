import { z } from 'zod';

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
  channel: z.enum(['whatsapp', 'phone', 'email', 'walk_in', 'field']).optional(),
  customerId: z.string().max(100).optional(),
  assetName: z.string().max(200).optional(),
  taskType: z.enum(['installation', 'maintenance', 'inspection', 'data', 'sales']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  dueAt: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  legs: z.array(ticketLegInputSchema).max(10).optional()
});

export const legIdSchema = z.object({
  legId: z.number().int().positive()
});
