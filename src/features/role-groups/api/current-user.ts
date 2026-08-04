import { createServerFn } from '@tanstack/react-start';
import { requireSession } from '@/lib/auth/session';
import type { RoleGroup } from '@/features/role-groups/api/types';

export const getCurrentUserRoleGroupFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession();
  const { getUserRoleGroup } = await import('@/lib/db/role-groups');
  return getUserRoleGroup(session.user.id);
});
