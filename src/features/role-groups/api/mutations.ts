import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createRoleGroupFn, updateRoleGroupFn, deleteRoleGroupFn } from './service';
import { roleGroupKeys } from './queries';
import type { RoleGroupMutationPayload } from './types';

export const createRoleGroupMutation = mutationOptions({
  mutationFn: (data: RoleGroupMutationPayload) => createRoleGroupFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: roleGroupKeys.all });
  }
});

export const updateRoleGroupMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: RoleGroupMutationPayload }) =>
    updateRoleGroupFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: roleGroupKeys.all });
  }
});

export const deleteRoleGroupMutation = mutationOptions({
  mutationFn: (id: string) => deleteRoleGroupFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: roleGroupKeys.all });
  }
});
