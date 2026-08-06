import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  departmentDeleteSchema,
  designationFilterSchema,
  designationCreateSchema,
  designationUpdateSchema,
  designationDeleteSchema
} from './validation';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

export const getDepartmentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('departments', 'view');
  const { getDepartments } = await import('@/lib/db/masterdata');
  return getDepartments();
});

export const createDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentCreateSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('departments', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { createDepartment } = await import('@/lib/db/masterdata');
    const created = await createDepartment(data);
    await withAudit(
      session.user.id,
      {
        action: 'department.create',
        entityType: 'department',
        entityId: created.department.id,
        before: null,
        after: created
      },
      async () => undefined
    );
    return created;
  });

export const updateDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentUpdateSchema)
  .handler(async ({ data: { id, ...data } }) => {
    const session = await requirePermission('departments', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateDepartment, getDepartmentById } = await import('@/lib/db/masterdata');
    const before = await getDepartmentById(id);
    const updated = await updateDepartment(id, data);
    await withAudit(
      session.user.id,
      {
        action: 'department.update',
        entityType: 'department',
        entityId: id,
        before,
        after: updated
      },
      async () => undefined
    );
    return updated;
  });

export const deleteDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentDeleteSchema)
  .handler(async ({ data: { id } }) => {
    const session = await requirePermission('departments', 'delete');
    await checkRateLimit(`write:${session.user.id}`);
    const { deleteDepartment, getDepartmentById } = await import('@/lib/db/masterdata');
    const before = await getDepartmentById(id);
    const deleted = await deleteDepartment(id);
    await withAudit(
      session.user.id,
      {
        action: 'department.delete',
        entityType: 'department',
        entityId: id,
        before,
        after: null
      },
      async () => undefined
    );
    return deleted;
  });

export const getDesignationsFn = createServerFn({ method: 'GET' })
  .validator(designationFilterSchema)
  .handler(async ({ data }) => {
    await requirePermission('designations', 'view');
    const { getDesignations } = await import('@/lib/db/masterdata');
    return getDesignations(data);
  });

export const createDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationCreateSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('designations', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { createDesignation } = await import('@/lib/db/masterdata');
    const created = await createDesignation(data);
    await withAudit(
      session.user.id,
      {
        action: 'designation.create',
        entityType: 'designation',
        entityId: created.designation.id,
        before: null,
        after: created
      },
      async () => undefined
    );
    return created;
  });

export const updateDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationUpdateSchema)
  .handler(async ({ data: { id, ...data } }) => {
    const session = await requirePermission('designations', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateDesignation, getDesignationById } = await import('@/lib/db/masterdata');
    const before = await getDesignationById(id);
    const updated = await updateDesignation(id, data);
    await withAudit(
      session.user.id,
      {
        action: 'designation.update',
        entityType: 'designation',
        entityId: id,
        before,
        after: updated
      },
      async () => undefined
    );
    return updated;
  });

export const deleteDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationDeleteSchema)
  .handler(async ({ data: { id } }) => {
    const session = await requirePermission('designations', 'delete');
    await checkRateLimit(`write:${session.user.id}`);
    const { deleteDesignation, getDesignationById } = await import('@/lib/db/masterdata');
    const before = await getDesignationById(id);
    const deleted = await deleteDesignation(id);
    await withAudit(
      session.user.id,
      {
        action: 'designation.delete',
        entityType: 'designation',
        entityId: id,
        before,
        after: null
      },
      async () => undefined
    );
    return deleted;
  });

export const getDesignationOptionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('designations', 'view');
  const { getDesignationsAsOptions } = await import('@/lib/db/masterdata');
  return getDesignationsAsOptions();
});

// Company Settings functions
export const getCompanySettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('masterdata', 'view');
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  return getCompanySettings();
});

export const updateCompanySettingsFn = createServerFn({ method: 'POST' })
  .validator((data: Partial<CompanySetting>) => data)
  .handler(async ({ data }) => {
    const session = await requirePermission('masterdata', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateCompanySettings } = await import('@/lib/db/masterdata');
    const result = await updateCompanySettings(data);
    await withAudit(
      session.user.id,
      {
        action: 'company_settings.update',
        entityType: 'company_settings',
        entityId: '1',
        before: null,
        after: result
      },
      async () => undefined
    );
    return result;
  });
