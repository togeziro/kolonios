import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createCustomerFn, updateCustomerFn, deleteCustomerFn } from './service';
import { customerKeys } from './queries';
import type { CustomerMutationPayload } from './types';

export const createCustomerMutation = mutationOptions({
  mutationFn: (data: CustomerMutationPayload) => createCustomerFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
  }
});

export const updateCustomerMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: CustomerMutationPayload }) =>
    updateCustomerFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
  }
});

export const deleteCustomerMutation = mutationOptions({
  mutationFn: (id: string) => deleteCustomerFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: customerKeys.all });
  }
});
