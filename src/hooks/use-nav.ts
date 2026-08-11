import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/auth-client';
import type { NavItem } from '@/types';
import type { Permissions, RoleGroup } from '@/features/role-groups/api/types';

function canAccessItem(item: NavItem, permissions?: Permissions, isAdmin?: boolean): boolean {
  if (item.hiddenForAdmin && isAdmin) return false;
  if (isAdmin) return true;
  if (!permissions) return true;
  if (!item.module) return true;
  const mod = permissions[item.module];
  return mod?.view === true;
}

export function filterNavItemsByRole(
  items: NavItem[],
  permissions?: Permissions,
  isAdmin?: boolean
): NavItem[] {
  return items
    .filter((item) => canAccessItem(item, permissions, isAdmin))
    .map((item) => {
      if (item.items && item.items.length > 0) {
        return { ...item, items: [...item.items] };
      }
      return item;
    });
}

export function useFilteredNavItems(
  items: NavItem[],
  permissions?: Permissions,
  isAdmin?: boolean
) {
  return useMemo(
    () => filterNavItemsByRole(items, permissions, isAdmin),
    [items, permissions, isAdmin]
  );
}

export function useRoleGroupPermissions() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data } = useQuery({
    queryKey: ['current-user-role-group', userId] as const,
    queryFn: async () => {
      const { getCurrentUserRoleGroupFn } = await import('@/features/role-groups/api/current-user');
      return getCurrentUserRoleGroupFn();
    },
    enabled: !!userId
  });

  const group = data as RoleGroup | null | undefined;
  const isAdmin = group?.is_admin ?? false;
  const permissions: Permissions = group?.permissions ?? {};

  return { isAdmin, permissions, group };
}
