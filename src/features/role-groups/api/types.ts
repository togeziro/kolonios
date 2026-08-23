import type { ModulePermissions, Permissions } from '@/lib/db/schema/role-groups';

export type { ModulePermissions as ModulePermission, Permissions };

export type RoleGroup = {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type RoleGroupFilters = {
  page?: number;
  limit?: number;
};

export type RoleGroupsResponse = {
  success: boolean;
  time: string;
  message: string;
  role_groups: RoleGroup[];
  total: number;
};

export type RoleGroupByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  role_group: RoleGroup;
};

export type RoleGroupMutationPayload = {
  name: string;
  description: string;
  permissions: Permissions;
  is_admin: boolean;
};
