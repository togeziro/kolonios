import { z } from 'zod';

// Date schema for YYYY-MM-DD format
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Holiday source enum
const holidaySourceSchema = z.enum(['manual', 'imported']);

// Create holiday validation schema
export const createNationalHolidaySchema = z.object({
  date: dateSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Holiday name is required')
    .max(200, 'Holiday name must be less than 200 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .nullable()
    .optional(),
  is_recurring: z.boolean().optional().default(false),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  source: holidaySourceSchema.optional().default('manual'),
  is_override: z.boolean().optional().default(false)
});

// Update holiday validation schema (all fields optional except id)
export const updateNationalHolidaySchema = z.object({
  id: z.number().int().positive('Holiday ID must be a positive integer'),
  data: z.object({
    date: dateSchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    is_recurring: z.boolean().optional(),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    source: holidaySourceSchema.optional(),
    is_override: z.boolean().optional()
  })
});

// Delete holiday validation schema
export const deleteNationalHolidaySchema = z.object({
  id: z.number().int().positive('Holiday ID must be a positive integer')
});

// Get holidays filter schema
export const getNationalHolidaysSchema = z.object({
  year: z.number().int().min(1900).max(2100).optional()
});

// Import holidays from API schema
export const importHolidaysSchema = z.object({
  year: z.number().int().min(1900).max(2100, 'Year must be between 1900 and 2100')
});

// Holiday API provider enum
export const holidayApiProviderSchema = z.enum(['nager_date', 'openholidays', 'custom']);

// Get holiday API settings schema (no input required)
export const getHolidayApiSettingsSchema = z.object({}).optional();

// Update holiday API settings schema
export const updateHolidayApiSettingsSchema = z.object({
  provider: holidayApiProviderSchema,
  url: z
    .string()
    .trim()
    .max(500, 'API URL must be less than 500 characters')
    .nullable()
    .optional()
    .default(''),
  api_key: z
    .string()
    .trim()
    .max(500, 'API key must be less than 500 characters')
    .nullable()
    .optional()
    .default(''),
  country_code: z
    .string()
    .trim()
    .min(2, 'Country code must be at least 2 characters')
    .max(5, 'Country code must be at most 5 characters')
});

// Types derived from schemas
export type CreateNationalHolidayInput = z.infer<typeof createNationalHolidaySchema>;
export type UpdateNationalHolidayInput = z.infer<typeof updateNationalHolidaySchema>;
export type DeleteNationalHolidayInput = z.infer<typeof deleteNationalHolidaySchema>;
export type GetNationalHolidaysInput = z.infer<typeof getNationalHolidaysSchema>;
export type ImportHolidaysInput = z.infer<typeof importHolidaysSchema>;
export type HolidayApiProvider = z.infer<typeof holidayApiProviderSchema>;
export type UpdateHolidayApiSettingsInput = z.infer<typeof updateHolidayApiSettingsSchema>;
