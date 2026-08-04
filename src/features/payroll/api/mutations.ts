import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approvePayrollFn,
  createPayrollPeriodFn,
  createSalaryComponentFn,
  deleteSalaryComponentFn,
  generatePayrollFn,
  lockPayrollFn,
  markPayrollPaidFn,
  updateSalaryComponentFn
} from './service';
import { payrollKeys } from './queries';

export function usePayrollMutation<T>(mutationFn: (data: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: payrollKeys.all })
  });
}
export const useCreateSalaryComponent = () =>
  usePayrollMutation((data: Parameters<typeof createSalaryComponentFn>[0]['data']) =>
    createSalaryComponentFn({ data })
  );
export const useUpdateSalaryComponent = () =>
  usePayrollMutation((data: Parameters<typeof updateSalaryComponentFn>[0]['data']) =>
    updateSalaryComponentFn({ data })
  );
export const useDeleteSalaryComponent = () =>
  usePayrollMutation((data: Parameters<typeof deleteSalaryComponentFn>[0]['data']) =>
    deleteSalaryComponentFn({ data })
  );
export const useCreatePayrollPeriod = () =>
  usePayrollMutation((data: Parameters<typeof createPayrollPeriodFn>[0]['data']) =>
    createPayrollPeriodFn({ data })
  );
export const useGeneratePayroll = () =>
  usePayrollMutation((data: Parameters<typeof generatePayrollFn>[0]['data']) =>
    generatePayrollFn({ data })
  );
export const useApprovePayroll = () =>
  usePayrollMutation((data: Parameters<typeof approvePayrollFn>[0]['data']) =>
    approvePayrollFn({ data })
  );
export const useMarkPayrollPaid = () =>
  usePayrollMutation((data: Parameters<typeof markPayrollPaidFn>[0]['data']) =>
    markPayrollPaidFn({ data })
  );
export const useLockPayroll = () =>
  usePayrollMutation((data: Parameters<typeof lockPayrollFn>[0]['data']) =>
    lockPayrollFn({ data })
  );
