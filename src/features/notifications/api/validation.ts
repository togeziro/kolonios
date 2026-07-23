import { z } from 'zod';
import type { AddNotificationPayload } from './types';

export const markAsReadSchema = z.object({
  id: z.number().int().positive('id must be a positive number')
});

export const removeNotificationSchema = z.object({
  id: z.number().int().positive('id must be a positive number')
});

export const addNotificationSchema: z.ZodType<AddNotificationPayload> = z.object({
  title: z.string().min(1, 'title is required'),
  body: z.string().min(1, 'body is required'),
  actions: z.array(z.any()).optional()
});
