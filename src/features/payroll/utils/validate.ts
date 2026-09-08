import type { PayrollCalculationInput } from '../api/types';
import { isMoney } from './money';

function assertNonNegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be non-negative and finite.`);
}

export function assertInput(input: PayrollCalculationInput) {
  const moneyValues: [number, string][] = [
    [input.salary.amount, 'salary.amount'],
    [input.tax.ptkp, 'tax.ptkp']
  ];
  for (const component of input.components)
    moneyValues.push([component.amount, `component:${component.name}`]);
  for (const adjustment of input.manualAdjustments) {
    moneyValues.push([adjustment.amount, `adjustment:${adjustment.name}`]);
  }
  if (input.attendancePolicy.absence.amount !== undefined) {
    moneyValues.push([input.attendancePolicy.absence.amount, 'absence.amount']);
  }
  if (input.attendancePolicy.unpaidLeave.amount !== undefined) {
    moneyValues.push([input.attendancePolicy.unpaidLeave.amount, 'unpaidLeave.amount']);
  }
  if (input.attendancePolicy.late.mode === 'fixed') {
    moneyValues.push([input.attendancePolicy.late.amount, 'late.amount']);
  }
  for (const [value, name] of moneyValues) {
    if (!isMoney(value)) throw new RangeError(`${name} must be an integer minor-unit amount.`);
  }
  const attendanceValues: [number, string][] = [
    [input.attendance.scheduledDays, 'scheduledDays'],
    [input.attendance.payableDays, 'payableDays'],
    [input.attendance.workedHours, 'workedHours'],
    [input.attendance.absentDays, 'absentDays'],
    [input.attendance.lateCount, 'lateCount'],
    [input.attendance.unpaidLeaveDays, 'unpaidLeaveDays']
  ];
  for (const [value, name] of attendanceValues) assertNonNegativeFinite(value, name);
  if (input.salary.dailyHours !== undefined)
    assertNonNegativeFinite(input.salary.dailyHours, 'dailyHours');
  if (input.attendancePolicy.late.mode === 'partial') {
    assertNonNegativeFinite(input.attendancePolicy.late.rate, 'late.rate');
  }
  for (const component of input.components) {
    if (component.mode === 'percentage') {
      assertNonNegativeFinite(component.amount, `component:${component.name}.rate`);
    }
  }
  const taxSettings = input.tax.settings;
  for (const brackets of [
    ...(taxSettings?.progressive ? [taxSettings.progressive] : []),
    ...Object.values(taxSettings?.ter ?? {})
  ]) {
    for (const bracket of brackets) {
      if (bracket.upTo !== null && !isMoney(bracket.upTo)) {
        throw new RangeError('Tax bracket limits must be integer minor-unit amounts.');
      }
      assertNonNegativeFinite(bracket.rate, 'tax.rate');
    }
  }
}
