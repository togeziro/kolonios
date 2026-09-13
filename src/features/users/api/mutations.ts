import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createUserFn, updateUserFn, deleteUserFn, setUserPasswordFn } from './service';
import { userKeys } from './queries';
import type { UserMutationPayload } from './types';
import type { SetUserPasswordPayload } from './validation';

export const createUserMutation = mutationOptions({
  mutationFn: (values: UserMutationPayload) => createUserFn({ data: { values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

export const updateUserMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: UserMutationPayload }) =>
    updateUserFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

export const deleteUserMutation = mutationOptions({
  mutationFn: (id: string) => deleteUserFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});

export const setUserPasswordMutation = mutationOptions({
  mutationFn: (data: SetUserPasswordPayload) => setUserPasswordFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: userKeys.all });
  }
});
