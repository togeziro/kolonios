import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/auth-client';
import type { NavItem, NavGroup } from '@/types';
import type { Permissions, RoleGroup } from '@/features/role-groups/api/types';

function canAccessItem(item: NavItem, permissions?: Permissions, isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  if (!permissions) return true;
  if (!item.module) return true;
  const mod = permissions[item.module];
  return mod?.view === true;
}

export function filterNavGroupsByRole(
  groups: NavGroup[],
  permissions?: Permissions,
  isAdmin?: boolean
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessItem(item, permissions, isAdmin))
    }))
    .filter((group) => group.items.length > 0);
}

export function useFilteredNavItems(
  items: NavItem[],
  permissions?: Permissions,
  isAdmin?: boolean
) {
  return useMemo(() => {
    return items
      .filter((item) => canAccessItem(item, permissions, isAdmin))
      .map((item) => {
        if (item.items && item.items.length > 0) {
          return { ...item, items: [...item.items] };
        }
        return item;
      });
  }, [items, permissions, isAdmin]);
}

export function useFilteredNavGroups(
  groups: NavGroup[],
  permissions?: Permissions,
  isAdmin?: boolean
) {
  const filteredGroups = useMemo(
    () => filterNavGroupsByRole(groups, permissions, isAdmin),
    [groups, permissions, isAdmin]
  );
  const allItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);
  const filteredItems = useFilteredNavItems(allItems, permissions, isAdmin);

  return useMemo(() => {
    const filteredSet = new Set(filteredItems.map((item) => item.title));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: filteredItems.filter((item) =>
          group.items.some((gi) => gi.title === item.title && filteredSet.has(gi.title))
        )
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredItems]);
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

  return { isAdmin, permissions };
}
