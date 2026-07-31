import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
import { withAudit } from '@/lib/audit';

const idSchema = z.string().min(1);

const roleGroupMutationSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(''),
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())).default({}),
  is_admin: z.boolean().default(false)
});

export const listRoleGroupsFn = createServerFn({ method: 'GET' }).handler(async () =>
  withRequestContext(async () => {
    await requirePermission('role_groups', 'view');
    const { getRoleGroups } = await import('@/lib/db/role-groups');
    return getRoleGroups();
  })
);

export const getRoleGroupByIdFn = createServerFn({ method: 'GET' })
  .validator(idSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      await requirePermission('role_groups', 'view');
      const { getRoleGroupById } = await import('@/lib/db/role-groups');
      return getRoleGroupById(id);
    })
  );

export const createRoleGroupFn = createServerFn({ method: 'POST' })
  .validator(roleGroupMutationSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requirePermission('role_groups', 'add');
      await checkRateLimit(`write:${session.user.id}`);
      const { createRoleGroup } = await import('@/lib/db/role-groups');
      const created = await createRoleGroup(data);
      if (!created.success) throw new Error(created.message);
      await withAudit(
        session.user.id,
        {
          action: 'role_group.create',
          entityType: 'role_group',
          entityId: created.role_group!.id,
          before: null,
          after: created.role_group
        },
        async () => undefined
      );
      return created;
    })
  );

export const updateRoleGroupFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: idSchema,
        values: roleGroupMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requirePermission('role_groups', 'edit');
      await checkRateLimit(`write:${session.user.id}`);
      const { updateRoleGroup, getRoleGroupById } = await import('@/lib/db/role-groups');
      const before = await getRoleGroupById(id);
      const updated = await updateRoleGroup(id, values);
      if (!updated.success) throw new Error(updated.message);
      await withAudit(
        session.user.id,
        {
          action: 'role_group.update',
          entityType: 'role_group',
          entityId: id,
          before: before.success ? before.role_group : null,
          after: updated.role_group
        },
        async () => undefined
      );
      return updated;
    })
  );

export const deleteRoleGroupFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requirePermission('role_groups', 'delete');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteRoleGroup, getRoleGroupById } = await import('@/lib/db/role-groups');
      const before = await getRoleGroupById(id);
      const deleted = await deleteRoleGroup(id);
      await withAudit(
        session.user.id,
        {
          action: 'role_group.delete',
          entityType: 'role_group',
          entityId: id,
          before: before.success ? before.role_group : null,
          after: null
        },
        async () => undefined
      );
      return deleted;
    })
  );
