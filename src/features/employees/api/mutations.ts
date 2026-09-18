import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createEmployeeFn, onboardEmployeeFn, updateEmployeeFn, deleteEmployeeFn } from './service';
import { employeeKeys } from './queries';
import { userKeys } from '@/features/users/api/queries';
import type { EmployeeMutationPayload, OnboardEmployeePayload } from './types';

function invalidateOnboardingLists() {
  getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  // Provisioning/linking flips the users table Employee Profile badge
  // (Pending → Complete), so the users list must refresh as well.
  getQueryClient().invalidateQueries({ queryKey: userKeys.all });
}

export const createEmployeeMutation = mutationOptions({
  mutationFn: (data: EmployeeMutationPayload) => createEmployeeFn({ data }),
  onSuccess: () => {
    invalidateOnboardingLists();
  }
});

export const updateEmployeeMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: string; values: EmployeeMutationPayload }) =>
    updateEmployeeFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  }
});

export const onboardEmployeeMutation = mutationOptions({
  mutationFn: (data: OnboardEmployeePayload) => onboardEmployeeFn({ data }),
  onSuccess: () => {
    invalidateOnboardingLists();
  }
});

export const deleteEmployeeMutation = mutationOptions({
  mutationFn: (id: string) => deleteEmployeeFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: employeeKeys.all });
  }
});
