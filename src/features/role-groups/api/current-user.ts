import { createServerFn } from '@tanstack/react-start';
import { requireSession } from '@/lib/auth/session';

export const getCurrentUserRoleGroupFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession();
  const { getUserRoleGroup } = await import('@/lib/db/role-groups');
  return getUserRoleGroup(session.user.id);
});
