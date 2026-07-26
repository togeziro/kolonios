import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';

export const getDepartmentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole('admin');
  const { getDepartments } = await import('@/lib/db/masterdata');
  return getDepartments();
});

export const createDepartmentFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(10),
      description: z.string().optional()
    })
  )
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createDepartment } = await import('@/lib/db/masterdata');
    return createDepartment(data);
  });

export const updateDepartmentFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().min(1).optional(),
      code: z.string().min(1).max(10).optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional()
    })
  )
  .handler(async ({ data: { id, ...data } }) => {
    await requireRole('admin');
    const { updateDepartment } = await import('@/lib/db/masterdata');
    return updateDepartment(id, data);
  });

export const deleteDepartmentFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.coerce.number().int().positive() }))
  .handler(async ({ data: { id } }) => {
    await requireRole('admin');
    const { deleteDepartment } = await import('@/lib/db/masterdata');
    return deleteDepartment(id);
  });

export const getDesignationsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ department_id: z.coerce.number().int().positive().optional() }).optional())
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { getDesignations } = await import('@/lib/db/masterdata');
    return getDesignations(data);
  });

export const createDesignationFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(10),
      department_id: z.coerce.number().int().positive().optional(),
      description: z.string().optional(),
      base_salary: z.coerce.number().positive().optional()
    })
  )
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createDesignation } = await import('@/lib/db/masterdata');
    return createDesignation(data);
  });

export const updateDesignationFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().min(1).optional(),
      code: z.string().min(1).max(10).optional(),
      department_id: z.coerce.number().int().positive().nullable().optional(),
      description: z.string().optional(),
      base_salary: z.coerce.number().positive().optional(),
      is_active: z.boolean().optional()
    })
  )
  .handler(async ({ data: { id, ...data } }) => {
    await requireRole('admin');
    const { updateDesignation } = await import('@/lib/db/masterdata');
    return updateDesignation(id, data);
  });

export const deleteDesignationFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.coerce.number().int().positive() }))
  .handler(async ({ data: { id } }) => {
    await requireRole('admin');
    const { deleteDesignation } = await import('@/lib/db/masterdata');
    return deleteDesignation(id);
  });

export const getDesignationOptionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole('employee');
  const { getDesignationsAsOptions } = await import('@/lib/db/masterdata');
  return getDesignationsAsOptions();
});
