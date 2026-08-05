import { queryOptions } from '@tanstack/react-query';
import {
  getCompanyPayrollSettingsFn,
  getEmployeePayrollProfileFn,
  getMyPayslipsFn,
  getPayrollReportFn,
  listEmployeeBpjsEnrollmentsFn,
  listPayrollPeriodsFn,
  listPayrollRecordsFn,
  listSalaryComponentsFn
} from './service';
import type { PayrollRecordFilters } from './types';

export type PayrollQueryFilters = PayrollRecordFilters & {
  payrollPeriodId?: number;
  employeeId?: string;
  scope?: 'admin' | 'employee';
};
export type PayrollReportFilters = PayrollQueryFilters & { format?: 'json' | 'csv' | 'xlsx' };
export const payrollKeys = {
  all: ['payroll'] as const,
  components: () => [...payrollKeys.all, 'components'] as const,
  profile: (employeeId: string) => [...payrollKeys.all, 'profile', employeeId] as const,
  periods: (filters: unknown = {}) => [...payrollKeys.all, 'periods', filters] as const,
  records: (filters: unknown = {}) => [...payrollKeys.all, 'records', filters] as const,
  report: (filters: unknown = {}) => [...payrollKeys.all, 'report', filters] as const,
  payslips: (filters: unknown = {}) => [...payrollKeys.all, 'payslips', filters] as const,
  companySettings: () => [...payrollKeys.all, 'company-settings'] as const,
  bpjs: (employeeId: string) => [...payrollKeys.all, 'bpjs', employeeId] as const,
  bpjsRoot: () => [...payrollKeys.all, 'bpjs'] as const,
  attendanceOverride: (periodId: number, employeeId: string) =>
    [...payrollKeys.all, 'attendance-override', periodId, employeeId] as const
};
export const salaryComponentsQueryOptions = () =>
  queryOptions({ queryKey: payrollKeys.components(), queryFn: () => listSalaryComponentsFn() });
export const employeePayrollProfileQueryOptions = (employeeId: string) =>
  queryOptions({
    queryKey: payrollKeys.profile(employeeId),
    queryFn: () => getEmployeePayrollProfileFn({ data: { employeeId } })
  });
export const payrollPeriodsQueryOptions = (filters: Record<string, unknown> = {}) =>
  queryOptions({
    queryKey: payrollKeys.periods(filters),
    queryFn: () => listPayrollPeriodsFn({ data: filters })
  });
export const payrollRecordsQueryOptions = (filters: PayrollQueryFilters = {}) =>
  queryOptions({
    queryKey: payrollKeys.records(filters),
    queryFn: () => listPayrollRecordsFn({ data: filters })
  });
export const payrollReportQueryOptions = (filters: PayrollReportFilters = {}) =>
  queryOptions({
    queryKey: payrollKeys.report(filters),
    queryFn: () => getPayrollReportFn({ data: filters })
  });
export const myPayslipsQueryOptions = (filters: PayrollQueryFilters = {}) =>
  queryOptions({
    queryKey: payrollKeys.payslips(filters),
    queryFn: () => getMyPayslipsFn({ data: filters })
  });
export const companyPayrollSettingsQueryOptions = () =>
  queryOptions({
    queryKey: payrollKeys.companySettings(),
    queryFn: () => getCompanyPayrollSettingsFn()
  });

export const employeeBpjsEnrollmentsQueryOptions = (employeeId: string) =>
  queryOptions({
    queryKey: payrollKeys.bpjs(employeeId),
    queryFn: () => listEmployeeBpjsEnrollmentsFn({ data: { employeeId } })
  });
