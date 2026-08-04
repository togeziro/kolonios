import { createMiddleware, createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import type { Permissions } from '@/features/role-groups/api/types';
import { logger } from '@/lib/logger';

export type Role = 'admin' | 'hr' | 'employee' | 'technician' | 'customer' | 'user';

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export function hasModulePermission(
  permissions: Permissions | undefined,
  isAdmin: boolean,
  module: string,
  action: PermissionAction
): boolean {
  if (isAdmin) return true;
  if (!permissions) return false;
  return permissions[module]?.[action] === true;
}

// Server-only: fetches the caller's role group from the DB. Wrapped in
// `createServerOnlyFn` so the `@/lib/db/role-groups` import (and the
// `postgres` driver behind it) is stripped from the client bundle instead of
// being pulled in via this module.
const loadRoleGroup = createServerOnlyFn(async (userId: string) => {
  const { getUserRoleGroup } = await import('@/lib/db/role-groups');
  return getUserRoleGroup(userId);
});

export async function requirePermission(module: string, action: PermissionAction = 'view') {
  const session = await requireSession();
  const group = await loadRoleGroup(session.user.id);

  // If no role group assigned, deny access
  if (!group) {
    // Check if user.role is admin for backward compatibility during migration
    if (session.user.role === 'admin') {
      logger.warn({ userId: session.user.id }, 'User has admin role but no role group assignment');
      return session;
    }
    throw new Error(`Forbidden: ${module}.${action} required`);
  }

  // Use role group for authorization
  if (hasModulePermission(group.permissions, group.is_admin, module, action)) {
    return session;
  }

  throw new Error(`Forbidden: ${module}.${action} required`);
}

export async function requireSession() {
  const { auth } = await import('./auth.server');
  const { getRequestHeaders } = await import('@tanstack/react-start/server');
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  return requireSession();
});

// RPC-bridged permission check for route guards (`requirePermission` itself
// touches server-only modules and cannot be imported into client routes).
// Call with `{ data: 'module.action' }`, e.g. 'attendance.edit'.
export const requirePermissionRpc = createServerFn({ method: 'GET' })
  .validator((input: string) => input)
  .handler(async ({ data }) => {
    const [module, action] = data.split('.');
    await requirePermission(module, action as PermissionAction);
  });

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await requireSession();
  return next({
    context: {
      session
    }
  });
});
