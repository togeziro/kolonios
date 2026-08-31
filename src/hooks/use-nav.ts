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
  return mod?.[item.requiredAction ?? 'view'] === true;
}

export function filterNavItemsByRole(
  items: NavItem[],
  permissions?: Permissions,
  isAdmin?: boolean
): NavItem[] {
  const visible: NavItem[] = [];
  for (const item of items) {
    if (!canAccessItem(item, permissions, isAdmin)) continue;
    if (item.items && item.items.length > 0) {
      const children = filterNavItemsByRole(item.items, permissions, isAdmin);
      // A dropdown grouping whose children are all invisible disappears too;
      // a parent that passes its own gate and keeps any child stays visible.
      if (children.length === 0) continue;
      visible.push({ ...item, items: children });
    } else {
      visible.push(item);
    }
  }
  return visible;
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
