// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it } from 'vitest';
import { aggregateAttendance, moneyToDisplay, parseSnapshot } from './-calculate-page';
import { toHoursMinutes } from './-records-columns';

describe('payroll calculate detail helpers', () => {
  it('formats Money (cents) to display string', () => {
    expect(moneyToDisplay(5000000)).toBeDefined();
    expect(moneyToDisplay(0)).toBeDefined();
    expect(moneyToDisplay(null)).toBeNull();
    expect(moneyToDisplay('100' as unknown as number)).toBeNull();
  });

  it('parses snapshot from row.details', () => {
    const row = {
      details: {
        baseSalary: 10000000,
        grossSalary: 12000000,
        netSalary: 11000000,
        allowanceTotal: 2000000,
        deductionTotal: 1000000,
        lineItems: [
          { name: 'Base', type: 'base', amount: 10000000 },
          { name: 'Tunjangan', type: 'allowance', amount: 2000000 },
          { name: 'Potongan', type: 'deduction', amount: 500000 },
          { name: 'PPh21', type: 'tax', amount: 500000 }
        ],
        input: [
          {
            attendance: {
              scheduledDays: 22,
              payableDays: 20,
              workedHours: 160,
              permitHours: 2,
              shortfallHours: 4,
              absentDays: 2,
              lateCount: 1,
              unpaidLeaveDays: 0
            }
          }
        ],
        resolvedSegments: [
          {
            result: {
              tax: {
                method: 'progressive',
                taxableIncome: 5000000,
                ptkp: 4500000,
                amount: 500000,
                category: 'TK0',
                bracket: '5%'
              }
            }
          }
        ]
      }
    } as unknown as Record<string, unknown>;
    const snap = parseSnapshot(row);
    expect(snap).not.toBeNull();
    expect(snap?.lineItems).toHaveLength(4);
    expect(snap?.baseSalary).toBe(10000000);
    expect(snap?.input).toHaveLength(1);
  });

  it('returns null for missing details', () => {
    expect(parseSnapshot({ details: null } as unknown as Record<string, unknown>)).toBeNull();
    expect(parseSnapshot({} as Record<string, unknown>)).toBeNull();
  });

  it('aggregates attendance across segments', () => {
    const inputs = [
      {
        attendance: {
          scheduledDays: 11,
          payableDays: 10,
          workedHours: 80,
          permitHours: 1,
          shortfallHours: 2,
          absentDays: 1,
          lateCount: 0,
          unpaidLeaveDays: 0
        }
      },
      {
        attendance: {
          scheduledDays: 11,
          payableDays: 10,
          workedHours: 80,
          permitHours: 1,
          shortfallHours: 2,
          absentDays: 1,
          lateCount: 1,
          unpaidLeaveDays: 0
        }
      }
    ] as unknown as Array<Record<string, unknown>>;
    const agg = aggregateAttendance(inputs);
    expect(agg.scheduledDays).toBe(22);
    expect(agg.payableDays).toBe(20);
    expect(agg.workedHours).toBe(160);
    expect(agg.lateCount).toBe(1);
  });

  it('handles empty input for attendance', () => {
    expect(aggregateAttendance([])).toEqual({
      scheduledDays: 0,
      payableDays: 0,
      workedHours: 0,
      permitHours: 0,
      shortfallHours: 0,
      absentDays: 0,
      lateCount: 0,
      unpaidLeaveDays: 0
    });
  });

  it('keeps toHoursMinutes coverage', () => {
    expect(toHoursMinutes(7.5)).toEqual({ whole: 7, minutes: 30 });
    expect(toHoursMinutes(null)).toEqual({ whole: 0, minutes: 0 });
  });

  it('filters deduction/bonus from lineItems', () => {
    const row = {
      details: {
        lineItems: [
          { name: 'Bonus A', type: 'allowance', amount: 100000 },
          { name: 'Potongan B', type: 'deduction', amount: 50000 },
          { name: 'Late', type: 'attendance-deduction', amount: 20000 },
          { name: 'Tax', type: 'tax', amount: 30000 }
        ],
        input: [],
        resolvedSegments: []
      }
    } as unknown as Record<string, unknown>;
    const snap = parseSnapshot(row)!;
    const deductions = snap.lineItems.filter(
      (i) => i.type === 'deduction' || i.type === 'attendance-deduction'
    );
    const bonuses = snap.lineItems.filter((i) => i.type === 'allowance');
    expect(deductions).toHaveLength(2);
    expect(bonuses).toHaveLength(1);
  });
});
