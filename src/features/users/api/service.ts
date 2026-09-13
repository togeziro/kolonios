// ============================================================
// User Service — Server-function wrappers
// ============================================================
// These wrappers expose the server-only data access (PostgreSQL via
// Drizzle) as TanStack Start server functions. The actual DB module is
// imported dynamically inside each handler, so the `postgres` driver is
// never bundled into the client. Every endpoint enforces a valid session
// and validates its input at the RPC boundary. User read/write endpoints
// are admin-scoped (Better Auth admin API), enforced via requirePermission('users', ...).

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import {
  userFiltersSchema,
  userIdSchema,
  userMutationSchema,
  userCreateSchema,
  setUserPasswordSchema
} from './validation';

export const getUsersFn = createServerFn({ method: 'GET' })
  .validator(userFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('users', 'view');
    const { getUsers } = await import('@/lib/db/users');
    return getUsers(data);
  });

export const createUserFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        values: userCreateSchema
      })
    )
  )
  .handler(async ({ data: { values } }) => {
    const session = await requirePermission('users', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { createUser } = await import('@/lib/db/users');
    const created = await createUser(values);
    await withAudit(
      session.user.id,
      {
        action: 'user.create',
        entityType: 'user',
        entityId: created.user.id,
        before: null,
        after: created
      },
      async () => undefined
    );
    return created;
  });

export const updateUserFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: userIdSchema,
        values: userMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) => {
    const session = await requirePermission('users', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateUser, getUserForAudit } = await import('@/lib/db/users');
    const before = await getUserForAudit(id);
    const updated = await updateUser(id, values);
    await withAudit(
      session.user.id,
      {
        action: 'user.update',
        entityType: 'user',
        entityId: id,
        before,
        after: updated
      },
      async () => undefined
    );
    return updated;
  });

export const deleteUserFn = createServerFn({ method: 'POST' })
  .validator(userIdSchema)
  .handler(async ({ data: id }) => {
    const session = await requirePermission('users', 'delete');
    await checkRateLimit(`write:${session.user.id}`);
    const { deleteUser, getUserForAudit } = await import('@/lib/db/users');
    const before = await getUserForAudit(id);
    const deleted = await deleteUser(id);
    await withAudit(
      session.user.id,
      {
        action: 'user.delete',
        entityType: 'user',
        entityId: id,
        before,
        after: null
      },
      async () => undefined
    );
    return deleted;
  });

/**
 * Admin replacing a user's password (row action). The audit trail records
 * WHOSE password was replaced and BY WHOM — never the password itself.
 */
export const setUserPasswordFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(setUserPasswordSchema))
  .handler(async ({ data: { userId, newPassword } }) => {
    const session = await requirePermission('users', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { replaceUserPassword } = await import('@/lib/db/users');
    const replaced = await replaceUserPassword(userId, newPassword);
    await withAudit(
      session.user.id,
      {
        action: 'user.set_password',
        entityType: 'user',
        entityId: userId,
        before: null,
        after: null
      },
      async () => undefined
    );
    return replaced;
  });
