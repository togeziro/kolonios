import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  approvePayrollFn,
  createPayrollPeriodFn,
  createSalaryComponentFn,
  deleteSalaryComponentFn,
  generatePayrollFn,
  lockPayrollFn,
  markPayrollPaidFn,
  updateSalaryComponentFn,
  updateEmployeePayrollProfileFn
} from './service';
import { payrollKeys } from './queries';

export const payrollMutationKeys = {
  components: () => [payrollKeys.components()] as const,
  profile: (employeeId: string) => [payrollKeys.profile(employeeId)] as const,
  periods: () => [payrollKeys.periods()] as const,
  generation: () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()] as const,
  workflow: () =>
    [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips()
    ] as const
};

export function usePayrollMutation<T>(
  mutationFn: (data: T) => Promise<unknown>,
  getKeys: (data: T) => QueryKey[]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, data) =>
      Promise.all(getKeys(data).map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  });
}
export const useCreateSalaryComponent = () =>
  usePayrollMutation(
    (data: Parameters<typeof createSalaryComponentFn>[0]['data']) =>
      createSalaryComponentFn({ data }),
    () => [payrollKeys.components()]
  );
export const useUpdateSalaryComponent = () =>
  usePayrollMutation(
    (data: Parameters<typeof updateSalaryComponentFn>[0]['data']) =>
      updateSalaryComponentFn({ data }),
    () => [payrollKeys.components()]
  );
export const useDeleteSalaryComponent = () =>
  usePayrollMutation(
    (data: Parameters<typeof deleteSalaryComponentFn>[0]['data']) =>
      deleteSalaryComponentFn({ data }),
    () => [payrollKeys.components()]
  );
export const useCreatePayrollPeriod = () =>
  usePayrollMutation(
    (data: Parameters<typeof createPayrollPeriodFn>[0]['data']) => createPayrollPeriodFn({ data }),
    () => [payrollKeys.periods()]
  );
export const useGeneratePayroll = () =>
  usePayrollMutation(
    (data: Parameters<typeof generatePayrollFn>[0]['data']) => generatePayrollFn({ data }),
    () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()]
  );
export const useApprovePayroll = () =>
  usePayrollMutation(
    (data: Parameters<typeof approvePayrollFn>[0]['data']) => approvePayrollFn({ data }),
    () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()]
  );
export const useMarkPayrollPaid = () =>
  usePayrollMutation(
    (data: Parameters<typeof markPayrollPaidFn>[0]['data']) => markPayrollPaidFn({ data }),
    () => [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips()
    ]
  );
export const useLockPayroll = () =>
  usePayrollMutation(
    (data: Parameters<typeof lockPayrollFn>[0]['data']) => lockPayrollFn({ data }),
    () => [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips()
    ]
  );
export const useUpdateEmployeePayrollProfile = () =>
  usePayrollMutation(
    (data: Parameters<typeof updateEmployeePayrollProfileFn>[0]['data']) =>
      updateEmployeePayrollProfileFn({ data }),
    (data) => [payrollKeys.profile(data.employeeId), payrollKeys.records()]
  );
