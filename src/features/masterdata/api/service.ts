import { createServerFn } from '@tanstack/react-start';
import { requireRole } from '@/lib/auth/session';
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  departmentDeleteSchema,
  designationFilterSchema,
  designationCreateSchema,
  designationUpdateSchema,
  designationDeleteSchema
} from './validation';

export const getDepartmentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole('admin');
  const { getDepartments } = await import('@/lib/db/masterdata');
  return getDepartments();
});

export const createDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentCreateSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createDepartment } = await import('@/lib/db/masterdata');
    return createDepartment(data);
  });

export const updateDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentUpdateSchema)
  .handler(async ({ data: { id, ...data } }) => {
    await requireRole('admin');
    const { updateDepartment } = await import('@/lib/db/masterdata');
    return updateDepartment(id, data);
  });

export const deleteDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentDeleteSchema)
  .handler(async ({ data: { id } }) => {
    await requireRole('admin');
    const { deleteDepartment } = await import('@/lib/db/masterdata');
    return deleteDepartment(id);
  });

export const getDesignationsFn = createServerFn({ method: 'GET' })
  .validator(designationFilterSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { getDesignations } = await import('@/lib/db/masterdata');
    return getDesignations(data);
  });

export const createDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationCreateSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createDesignation } = await import('@/lib/db/masterdata');
    return createDesignation(data);
  });

export const updateDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationUpdateSchema)
  .handler(async ({ data: { id, ...data } }) => {
    await requireRole('admin');
    const { updateDesignation } = await import('@/lib/db/masterdata');
    return updateDesignation(id, data);
  });

export const deleteDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationDeleteSchema)
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
