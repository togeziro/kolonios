import { describe, expect, it } from 'vitest';
import {
  assertEmployeeScope,
  assertProfileReferenceScope,
  buildAttendanceTotals,
  mapTaxProfile,
  resolvePayrollRecordScope,
  serializePayrollReport
} from './service';

describe('payroll service boundaries', () => {
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
        [{ start_date: '2026-06-25', end_date: '2026-07-10', total_days: 16, status: 'approved' }],
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

  it('emits CSV only when requested', () => {
    expect(
      serializePayrollReport({ rows: [{ employee_id: 'e1', net_salary: '10.00' }] }, 'csv')
    ).toMatchObject({
      mime: 'text/csv',
      content: expect.stringContaining('employee_id,net_salary')
    });
  });
});
