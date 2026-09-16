import type { Permissions } from '@/lib/db/schema/role-groups';

export type { Permissions };

export type RoleGroup = {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type RoleGroupMutationPayload = {
  name: string;
  description: string;
  permissions: Permissions;
  is_admin: boolean;
};
