// ============================================================
// User Service — Server-function wrappers
// ============================================================
// These wrappers expose the server-only data access (PostgreSQL via
// Drizzle) as TanStack Start server functions. The actual DB module is
// imported dynamically inside each handler, so the `postgres` driver is
// never bundled into the client. Every endpoint enforces a valid session
// and validates its input at the RPC boundary. User read/write endpoints
// are admin-scoped (Better Auth admin API), enforced via requireRole('admin').

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { userFiltersSchema, userIdSchema, userMutationSchema } from './validation';

export const getUsersFn = createServerFn({ method: 'GET' })
  .validator(userFiltersSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { getUsers } = await import('@/lib/db/users');
    return getUsers(data);
  });

export const createUserFn = createServerFn({ method: 'POST' })
  .validator(userMutationSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createUser } = await import('@/lib/db/users');
    return createUser(data);
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
    await requireRole('admin');
    const { updateUser } = await import('@/lib/db/users');
    return updateUser(id, values);
  });

export const deleteUserFn = createServerFn({ method: 'POST' })
  .validator(userIdSchema)
  .handler(async ({ data: id }) => {
    await requireRole('admin');
    const { deleteUser } = await import('@/lib/db/users');
    return deleteUser(id);
  });
