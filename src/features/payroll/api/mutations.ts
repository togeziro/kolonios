import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  alignBaseSalaryFn,
  approvePayrollFn,
  adjustPayrollRecordFn,
  createEmployeeBpjsFamilyMemberFn,
  createPayrollPeriodFn,
  createSalaryComponentFn,
  deleteEmployeeBpjsFamilyMemberFn,
  deleteSalaryComponentFn,
  generatePayrollFn,
  lockPayrollFn,
  markPayrollPaidFn,
  overrideEmployeeTaxRecordFn,
  payPayQueueSelectionFn,
  updateCompanyPayrollSettingsFn,
  updateSalaryComponentFn,
  updateEmployeePayrollProfileFn,
  upsertAttendanceOverrideFn,
  upsertEmployeeBpjsEnrollmentFn
} from './service';
import { payrollKeys } from './queries';

export const payrollMutationKeys = {
  components: () => payrollKeys.components(),
  profile: (employeeId: string) => payrollKeys.profile(employeeId),
  periods: () => payrollKeys.periods(),
  generation: () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()] as const,
  workflow: () =>
    [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips(),
      payrollKeys.payQueue()
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
      Promise.all(
        getKeys(data).map((queryKey) => queryClient.invalidateQueries({ queryKey, exact: false }))
      )
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
export const useAdjustPayrollRecord = () =>
  usePayrollMutation(
    (data: Parameters<typeof adjustPayrollRecordFn>[0]['data']) => adjustPayrollRecordFn({ data }),
    () => [payrollKeys.records(), payrollKeys.report()]
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
export const usePayQueueSelection = () =>
  usePayrollMutation(
    (data: Parameters<typeof payPayQueueSelectionFn>[0]['data']) =>
      payPayQueueSelectionFn({ data }),
    () => [payrollMutationKeys.workflow()]
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
export const useUpdateCompanyPayrollSettings = () =>
  usePayrollMutation(
    (data: Parameters<typeof updateCompanyPayrollSettingsFn>[0]['data']) =>
      updateCompanyPayrollSettingsFn({ data }),
    () => [payrollKeys.companySettings()]
  );
export const useUpsertEmployeeBpjsEnrollment = () =>
  usePayrollMutation(
    (data: Parameters<typeof upsertEmployeeBpjsEnrollmentFn>[0]['data']) =>
      upsertEmployeeBpjsEnrollmentFn({ data }),
    (data) => [payrollKeys.bpjs(data.employeeId)]
  );
export const useCreateEmployeeBpjsFamilyMember = () =>
  usePayrollMutation(
    (data: Parameters<typeof createEmployeeBpjsFamilyMemberFn>[0]['data']) =>
      createEmployeeBpjsFamilyMemberFn({ data }),
    () => [payrollKeys.bpjsRoot()]
  );
export const useDeleteEmployeeBpjsFamilyMember = () =>
  usePayrollMutation(
    (data: Parameters<typeof deleteEmployeeBpjsFamilyMemberFn>[0]['data']) =>
      deleteEmployeeBpjsFamilyMemberFn({ data }),
    () => [payrollKeys.bpjsRoot()]
  );
export const useUpsertAttendanceOverride = () =>
  usePayrollMutation(
    (data: Parameters<typeof upsertAttendanceOverrideFn>[0]['data']) =>
      upsertAttendanceOverrideFn({ data }),
    (data) => [
      payrollKeys.attendanceOverride(data.payrollPeriodId, data.employeeId),
      payrollKeys.records()
    ]
  );
export const useOverrideEmployeeTaxRecord = () =>
  usePayrollMutation(
    (data: Parameters<typeof overrideEmployeeTaxRecordFn>[0]['data']) =>
      overrideEmployeeTaxRecordFn({ data }),
    () => [['payroll', 'profile'] as const]
  );
export const useAlignBaseSalary = () =>
  usePayrollMutation(
    (data: Parameters<typeof alignBaseSalaryFn>[0]['data']) => alignBaseSalaryFn({ data }),
    // Alignment touches many employees' profiles at once; invalidate broadly.
    () => [payrollKeys.all]
  );
