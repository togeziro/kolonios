import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';

/**
 * Self-scoped work info for the signed-in user (employee record keyed by
 * user.id). Returns only work-identity fields; any signed-in user may read
 * their own via the profile page.
 */
export const getMyEmployeeFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('profile', 'view');
  const { getMyEmployee } = await import('@/lib/db/employees');
  return getMyEmployee(session.user.id);
});
