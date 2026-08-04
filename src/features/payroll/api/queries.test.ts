import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  listSalaryComponentsFn: vi.fn(),
  getEmployeePayrollProfileFn: vi.fn(),
  listPayrollPeriodsFn: vi.fn(),
  listPayrollRecordsFn: vi.fn(),
  getPayrollReportFn: vi.fn(),
  getMyPayslipsFn: vi.fn()
}));

import { payrollKeys, payrollRecordsQueryOptions } from './queries';
import { listPayrollRecordsFn } from './service';

describe('payroll query options', () => {
  it('keeps employee scope in the record key and request', () => {
    const filters = { employeeId: 'employee-1', scope: 'employee' as const };
    const options = payrollRecordsQueryOptions(filters);
    expect(options.queryKey).toEqual(['payroll', 'records', filters]);
    options.queryFn!(undefined as never);
    expect(listPayrollRecordsFn).toHaveBeenCalledWith({ data: filters });
    expect(payrollKeys.all).toEqual(['payroll']);
  });
});
