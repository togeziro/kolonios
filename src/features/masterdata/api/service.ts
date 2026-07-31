import { createServerFn } from '@tanstack/react-start';
import { requireMinRole, requireRole } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
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

export const getDepartmentsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requireRole('admin');
    const { getDepartments } = await import('@/lib/db/masterdata');
    return getDepartments();
  })
);

export const createDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentCreateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const updateDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentUpdateSchema)
  .handler(async ({ data: { id, ...data } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const deleteDepartmentFn = createServerFn({ method: 'POST' })
  .validator(departmentDeleteSchema)
  .handler(async ({ data: { id } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const getDesignationsFn = createServerFn({ method: 'GET' })
  .validator(designationFilterSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requireRole('admin');
      const { getDesignations } = await import('@/lib/db/masterdata');
      return getDesignations(data);
    })
  );

export const createDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationCreateSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const updateDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationUpdateSchema)
  .handler(async ({ data: { id, ...data } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const deleteDesignationFn = createServerFn({ method: 'POST' })
  .validator(designationDeleteSchema)
  .handler(async ({ data: { id } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
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
    })
  );

export const getDesignationOptionsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requireMinRole('employee');
    const { getDesignationsAsOptions } = await import('@/lib/db/masterdata');
    return getDesignationsAsOptions();
  })
);
