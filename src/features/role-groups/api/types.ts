export type ModulePermission = Record<string, boolean>;

export type Permissions = Record<string, ModulePermission>;

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
