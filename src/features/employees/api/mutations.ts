import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createEmployeeFn, updateEmployeeFn, deleteEmployeeFn } from './service';
import { employeeKeys } from './queries';
import type { EmployeeMutationPayload } from './types';

export const createEmployeeMutation = mutationOptions({
  mutationFn: (data: EmployeeMutationPayload) => createEmployeeFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  }
});

export const updateEmployeeMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: EmployeeMutationPayload }) =>
    updateEmployeeFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  }
});

export const deleteEmployeeMutation = mutationOptions({
  mutationFn: (id: string) => deleteEmployeeFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  }
});
