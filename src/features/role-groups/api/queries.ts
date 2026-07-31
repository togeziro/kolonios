import { queryOptions } from '@tanstack/react-query';
import { listRoleGroupsFn, getRoleGroupByIdFn } from './service';
import type { RoleGroup } from './types';

export type { RoleGroup };

export const roleGroupKeys = {
  all: ['role-groups'] as const,
  list: () => [...roleGroupKeys.all, 'list'] as const,
  detail: (id: string) => [...roleGroupKeys.all, 'detail', id] as const
};

export const roleGroupsQueryOptions = () =>
  queryOptions({
    queryKey: roleGroupKeys.list(),
    queryFn: () => listRoleGroupsFn()
  });

export const roleGroupByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: roleGroupKeys.detail(id),
    queryFn: () => getRoleGroupByIdFn({ data: id })
  });
