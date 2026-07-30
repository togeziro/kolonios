import { z } from 'zod';

export const departmentCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  description: z.string().optional()
});

export const departmentUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(10).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional()
});

export const departmentDeleteSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const designationFilterSchema = z
  .object({
    department_id: z.coerce.number().int().positive().optional()
  })
  .optional();

export const designationCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  department_id: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  base_salary: z.coerce.number().positive().optional()
});

export const designationUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(10).optional(),
  department_id: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().optional(),
  base_salary: z.coerce.number().positive().optional(),
  is_active: z.boolean().optional()
});

export const designationDeleteSchema = z.object({
  id: z.coerce.number().int().positive()
});
