import { describe, expect, it } from 'vitest';
import type { ScheduleGridCell } from '../api/types';
import { getCellIdentityKey } from './cell-identity';

function makeCell(overrides: Partial<ScheduleGridCell> = {}): ScheduleGridCell {
  return {
    date: '2026-09-01',
    shiftId: null,
    shiftName: null,
    startTime: null,
    endTime: null,
    lateToleranceMinutes: null,
    absenceCutoffMinutes: null,
    isDayOff: false,
    hasAssignment: false,
    isHoliday: false,
    holidayName: null,
    holidayOverUnassigned: false,
    dayOffReason: null,
    policyMissing: false,
    ...overrides
  };
}

describe('getCellIdentityKey', () => {
  it('produces the same key for cells with identical state', () => {
    const a = makeCell({ shiftId: 1, hasAssignment: true });
    const b = makeCell({ shiftId: 1, hasAssignment: true });
    expect(getCellIdentityKey(a)).toBe(getCellIdentityKey(b));
  });

  it('changes when shiftId changes', () => {
    const before = makeCell({ shiftId: 1, hasAssignment: true });
    const after = makeCell({ shiftId: 2, hasAssignment: true });
    expect(getCellIdentityKey(before)).not.toBe(getCellIdentityKey(after));
  });

  it('changes when isDayOff flips (the bug fix from EPIC_SUMMARY § Follow-ups #4)', () => {
    const before = makeCell({ isDayOff: false, hasAssignment: true });
    const after = makeCell({ isDayOff: true, hasAssignment: true });
    expect(getCellIdentityKey(before)).not.toBe(getCellIdentityKey(after));
  });

  it('changes when dayOffReason changes', () => {
    const before = makeCell({
      isDayOff: true,
      hasAssignment: true,
      dayOffReason: 'Cuti'
    });
    const after = makeCell({
      isDayOff: true,
      hasAssignment: true,
      dayOffReason: 'Sakit'
    });
    expect(getCellIdentityKey(before)).not.toBe(getCellIdentityKey(after));
  });

  it('changes when hasAssignment flips (unassignment surface from ticket 03)', () => {
    const before = makeCell({ hasAssignment: true, shiftId: 5 });
    const after = makeCell({ hasAssignment: false });
    expect(getCellIdentityKey(before)).not.toBe(getCellIdentityKey(after));
  });

  it('does NOT change when only volatile read-only fields change', () => {
    const before = makeCell({ isHoliday: false, holidayOverUnassigned: false });
    const after = makeCell({ isHoliday: true, holidayOverUnassigned: true });
    expect(getCellIdentityKey(before)).toBe(getCellIdentityKey(after));
  });

  it('does NOT change when policyMissing changes (read-only flag, not writeable state)', () => {
    const before = makeCell({
      hasAssignment: true,
      shiftId: 1,
      policyMissing: false
    });
    const after = makeCell({
      hasAssignment: true,
      shiftId: 1,
      policyMissing: true
    });
    expect(getCellIdentityKey(before)).toBe(getCellIdentityKey(after));
  });

  it('distinguishes null from the literal string "null" via the null mark', () => {
    const nullReason = makeCell({ dayOffReason: null });
    const textNull = makeCell({ dayOffReason: 'null' });
    expect(getCellIdentityKey(nullReason)).not.toBe(getCellIdentityKey(textNull));
  });
});
