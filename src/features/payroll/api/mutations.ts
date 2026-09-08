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
  generation: () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()] as const
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

type PayrollMutation<T> = {
  fn: (input: { data: T }) => Promise<unknown>;
  keys: (data: T) => QueryKey[];
};

function defineMutation<T>({ fn, keys }: PayrollMutation<T>) {
  return () => usePayrollMutation((data: Parameters<typeof fn>[0]['data']) => fn({ data }), keys);
}

const payrollMutations = {
  useCreateSalaryComponent: defineMutation({
    fn: createSalaryComponentFn,
    keys: () => [payrollKeys.components()]
  }),
  useUpdateSalaryComponent: defineMutation({
    fn: updateSalaryComponentFn,
    keys: () => [payrollKeys.components()]
  }),
  useDeleteSalaryComponent: defineMutation({
    fn: deleteSalaryComponentFn,
    keys: () => [payrollKeys.components()]
  }),
  useCreatePayrollPeriod: defineMutation({
    fn: createPayrollPeriodFn,
    keys: () => [payrollKeys.periods()]
  }),
  useGeneratePayroll: defineMutation({
    fn: generatePayrollFn,
    keys: () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()]
  }),
  useAdjustPayrollRecord: defineMutation({
    fn: adjustPayrollRecordFn,
    keys: () => [payrollKeys.records(), payrollKeys.report()]
  }),
  useApprovePayroll: defineMutation({
    fn: approvePayrollFn,
    keys: () => [payrollKeys.periods(), payrollKeys.records(), payrollKeys.report()]
  }),
  useMarkPayrollPaid: defineMutation({
    fn: markPayrollPaidFn,
    keys: () => [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips()
    ]
  }),
  usePayQueueSelection: defineMutation({
    fn: payPayQueueSelectionFn,
    // Flatten the workflow tuple so each entry is its own QueryKey —
    // otherwise TanStack Query treats the whole tuple as one prefix and
    // never matches the individual `['payroll', 'periods', ...]` etc. keys
    // already in the cache, so the records page + payment history + queue
    // show stale data after a bulk-pay stamp (issue #02).
    keys: () => [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips(),
      payrollKeys.payQueue()
    ]
  }),
  useLockPayroll: defineMutation({
    fn: lockPayrollFn,
    keys: () => [
      payrollKeys.periods(),
      payrollKeys.records(),
      payrollKeys.report(),
      payrollKeys.payslips()
    ]
  }),
  useUpdateEmployeePayrollProfile: defineMutation({
    fn: updateEmployeePayrollProfileFn,
    keys: (data) => [payrollKeys.profile(data.employeeId), payrollKeys.records()]
  }),
  useUpdateCompanyPayrollSettings: defineMutation({
    fn: updateCompanyPayrollSettingsFn,
    keys: () => [payrollKeys.companySettings()]
  }),
  useUpsertEmployeeBpjsEnrollment: defineMutation({
    fn: upsertEmployeeBpjsEnrollmentFn,
    keys: (data) => [payrollKeys.bpjs(data.employeeId)]
  }),
  useCreateEmployeeBpjsFamilyMember: defineMutation({
    fn: createEmployeeBpjsFamilyMemberFn,
    keys: () => [payrollKeys.bpjsRoot()]
  }),
  useDeleteEmployeeBpjsFamilyMember: defineMutation({
    fn: deleteEmployeeBpjsFamilyMemberFn,
    keys: () => [payrollKeys.bpjsRoot()]
  }),
  useUpsertAttendanceOverride: defineMutation({
    fn: upsertAttendanceOverrideFn,
    keys: (data) => [
      payrollKeys.attendanceOverride(data.payrollPeriodId, data.employeeId),
      payrollKeys.records()
    ]
  }),
  useOverrideEmployeeTaxRecord: defineMutation({
    fn: overrideEmployeeTaxRecordFn,
    keys: () => [['payroll', 'profile'] as const]
  }),
  useAlignBaseSalary: defineMutation({
    fn: alignBaseSalaryFn,
    // Alignment touches many employees' profiles at once; invalidate broadly.
    keys: () => [payrollKeys.all]
  })
};

export const {
  useCreateSalaryComponent,
  useUpdateSalaryComponent,
  useDeleteSalaryComponent,
  useCreatePayrollPeriod,
  useGeneratePayroll,
  useAdjustPayrollRecord,
  useApprovePayroll,
  useMarkPayrollPaid,
  usePayQueueSelection,
  useLockPayroll,
  useUpdateEmployeePayrollProfile,
  useUpdateCompanyPayrollSettings,
  useUpsertEmployeeBpjsEnrollment,
  useCreateEmployeeBpjsFamilyMember,
  useDeleteEmployeeBpjsFamilyMember,
  useUpsertAttendanceOverride,
  useOverrideEmployeeTaxRecord,
  useAlignBaseSalary
} = payrollMutations;
