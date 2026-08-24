import { describe, expect, it } from 'vitest';
import { resolvePayrollRecordScope } from './records';
import { serializePayrollReport } from './reports';
import { getCompanyProfile } from './settings';
import { mapTaxProfile } from './tax';
import {
  assertEmployeeScope,
  assertProfileReferenceScope,
  buildAttendanceTotals,
  closeEffectiveRecordAt,
  mapSalaryComponent,
  payrollPeriodBoundaries,
  sanitizePayrollProfileForActor
} from './service';

describe('payroll service boundaries', () => {
  it('returns a typed configured company profile with an explicit fallback', () => {
    expect(getCompanyProfile()).toMatchObject({ name: expect.any(String) });
  });
  it('prevents staff users from reading another employee payroll profile', () => {
    expect(() =>
      assertEmployeeScope({ user: { id: 'employee-1', role: 'employee' } }, 'employee-2')
    ).toThrow(/forbidden/i);
  });

  it('allows HR to operate on another employee payroll profile', () => {
    expect(() =>
      assertEmployeeScope({ user: { id: 'hr-1', role: 'hr' } }, 'employee-2')
    ).not.toThrow();
  });

  it('rejects cross-employee payroll component references for staff payroll editors', () => {
    expect(() =>
      assertProfileReferenceScope(
        { user: { id: 'employee-1', role: 'employee' } },
        'employee-1',
        'employee-2'
      )
    ).toThrow(/forbidden/i);
  });

  it('ignores client scope and employee filters for staff record reads', () => {
    expect(() =>
      resolvePayrollRecordScope(
        { user: { id: 'employee-1', role: 'employee' } },
        { scope: 'admin', employeeId: 'employee-2' }
      )
    ).toThrow(/forbidden/i);
    expect(() =>
      resolvePayrollRecordScope(
        { user: { id: 'employee-1', role: 'employee' } },
        { scope: 'employee', employeeId: 'employee-2' }
      )
    ).toThrow(/forbidden/i);
  });

  it('maps persisted tax decimals to calculator minor units and rejects malformed settings', () => {
    const profile = { filing_status: 'TK/0' } as never;
    const mapped = mapTaxProfile(profile, {
      rates: {
        method: 'progressive',
        ptkp: '54000000.00',
        progressive: [
          { upTo: '60000000.00', rate: '5' },
          { upTo: null, rate: '15' }
        ]
      }
    });
    expect(mapped.ptkp).toBe(5_400_000_000);
    expect(mapped.settings?.progressive?.[0]).toEqual({ upTo: 6_000_000_000, rate: 5 });
    expect(() => mapTaxProfile(profile, { rates: { ptkp: 'bad' } })).toThrow(/tax/i);
  });

  it('maps persisted salary component mode and taxability without defaulting to fixed', () => {
    expect(
      mapSalaryComponent(
        {
          amount: '10.00',
          mode: 'percentage',
          percentage_base: 'gross-salary',
          attendance_metric: null,
          taxable: true
        },
        { name: 'Housing', type: 'allowance' },
        4
      )
    ).toEqual({
      name: 'Housing',
      type: 'allowance',
      mode: 'percentage',
      amount: 10,
      percentageBase: 'gross-salary',
      attendanceMetric: 'payable-days',
      taxable: true
    });
  });

  it('masks tax identifiers and bank numbers for employee profile reads', () => {
    const result = sanitizePayrollProfileForActor(
      { user: { id: 'employee-1', role: 'employee' } },
      {
        taxProfiles: [{ tax_identifier: 'NPWP-123' }],
        tax: { tax_identifier: 'NPWP-456' },
        bankAccounts: [{ account_number: '123456789' }],
        bank: { account_number: '987654321' }
      }
    );
    expect(result.taxProfiles[0]).not.toHaveProperty('tax_identifier');
    expect(result.tax).not.toHaveProperty('tax_identifier');
    expect(result.bankAccounts[0].account_number).toBe('******6789');
    expect(result.bank.account_number).toBe('******4321');
  });

  it('closes historical profile rows before inserting a later effective version', () => {
    expect(closeEffectiveRecordAt('2026-01-01', '2026-07-01')).toBe('2026-06-30');
    expect(() => closeEffectiveRecordAt('2026-07-01', '2026-07-01')).toThrow(/effective/i);
  });

  it('creates period segments for mid-period effective salary and tax changes', () => {
    expect(
      payrollPeriodBoundaries('2026-07-01', '2026-07-31', [
        '2026-01-01',
        '2026-07-16',
        '2026-08-01'
      ])
    ).toEqual(['2026-07-01', '2026-07-16']);
  });

  it('clips approved leave, excludes pending attendance, and does not invent a scheduled day', () => {
    expect(
      buildAttendanceTotals(
        [
          {
            date: '2026-07-05',
            attendance_status: 'pending',
            check_in_time: null,
            check_out_time: null
          },
          {
            date: '2026-07-06',
            attendance_status: 'present',
            check_in_time: '09:00',
            check_out_time: '17:00'
          }
        ],
        [
          {
            start_date: '2026-06-25',
            end_date: '2026-07-10',
            total_days: 16,
            status: 'approved',
            is_paid: false
          }
        ],
        {
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          scheduledDays: 0,
          payableDays: 0,
          absentDays: 0
        }
      )
    ).toMatchObject({ scheduledDays: 0, payableDays: 1, workedHours: 8, unpaidLeaveDays: 10 });
  });

  it('does not deduct approved paid leave', () => {
    expect(
      buildAttendanceTotals(
        [],
        [
          {
            start_date: '2026-07-10',
            end_date: '2026-07-12',
            total_days: 3,
            status: 'approved',
            is_paid: true
          }
        ],
        {
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          scheduledDays: 20,
          payableDays: 20,
          absentDays: 0
        }
      )
    ).toMatchObject({ unpaidLeaveDays: 0 });
  });

  it('emits CSV only when requested', () => {
    expect(
      serializePayrollReport({ rows: [{ employee_id: 'e1', net_salary: '10.00' }] }, 'csv')
    ).toMatchObject({
      mime: 'text/csv',
      encoding: 'identity',
      content: expect.stringContaining('employee_id,net_salary')
    });
  });

  it('aggregates complete payroll rows by department, tax, and display-unit components', async () => {
    const { aggregatePayrollRows } = await import('./reports');
    const result = aggregatePayrollRows([
      {
        employee_id: 'e1',
        department_name: 'Engineering',
        gross_salary: '100.00',
        total_allowances: '20.00',
        total_deductions: '5.00',
        net_salary: '95.00',
        details: {
          tax: { amount: 300 },
          lineItems: [
            { name: 'Base salary', type: 'base', amount: 10000 },
            { name: 'Transport', type: 'allowance', amount: 2000 },
            { name: 'Loan', type: 'deduction', amount: 500 },
            { name: 'Absent day', type: 'attendance-deduction', amount: 1000 },
            { name: 'PPh 21', type: 'tax', amount: 300 }
          ]
        }
      }
    ]);
    expect(result.departmentTotals).toEqual([{ department: 'Engineering', gross: 100, net: 95 }]);
    expect(result.taxTotal).toBe(3);
    expect(result.componentTotals).toEqual([
      { name: 'Transport', type: 'allowance', amount: 20 },
      { name: 'Loan', type: 'deduction', amount: 5 },
      { name: 'Absent day', type: 'deduction', amount: 10 }
    ]);
  });

  it('allows adjustments only while a payroll period is processing', async () => {
    const { assertPayrollAdjustmentAllowed } = await import('./records');
    expect(() => assertPayrollAdjustmentAllowed('processing')).not.toThrow();
    expect(() => assertPayrollAdjustmentAllowed('ready_to_pay')).toThrow(/approval/i);
  });
});
