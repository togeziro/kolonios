/**
 * Table-driven unit tests for `planClearAssignmentRange` — the pure
 * range-trim decision behind the row-header "Clear week" action.
 *
 * The week under test is Mon 2026-09-07 .. Sun 2026-09-13 (`weekStart`
 * 2026-09-07 + 6 days). Every case pins the exact resulting row(s) so the
 * server fn's write loop has no room to invent an inverted/empty range:
 * the guard `effective_from <= effective_to` is asserted implicitly by the
 * produced boundaries.
 */

import { describe, expect, it } from 'vitest';

import { planClearAssignmentRange } from './clear-week';

const WEEK_START = '2026-09-07';
const WEEK_END = '2026-09-13';

function plan(effectiveFrom: string, effectiveTo: string) {
  return planClearAssignmentRange({
    effectiveFrom,
    effectiveTo,
    weekStart: WEEK_START,
    weekEnd: WEEK_END
  });
}

describe('planClearAssignmentRange', () => {
  it('deletes a range fully inside the week', () => {
    expect(plan('2026-09-08', '2026-09-11')).toEqual({ kind: 'delete' });
  });

  it('deletes a range that exactly equals the week', () => {
    expect(plan(WEEK_START, WEEK_END)).toEqual({ kind: 'delete' });
  });

  it('deletes a single-day range inside the week', () => {
    expect(plan('2026-09-09', '2026-09-09')).toEqual({ kind: 'delete' });
  });

  it('deletes a single-day range on the week start', () => {
    expect(plan(WEEK_START, WEEK_START)).toEqual({ kind: 'delete' });
  });

  it('trims the start when the range begins inside the week and runs past it', () => {
    // 09-09..09-30 → keep only 09-14..09-30
    expect(plan('2026-09-09', '2026-09-30')).toEqual({
      kind: 'trimStart',
      remainingFrom: '2026-09-14'
    });
  });

  it('trims the start when the range starts exactly on the week end', () => {
    expect(plan(WEEK_END, '2026-09-30')).toEqual({
      kind: 'trimStart',
      remainingFrom: '2026-09-14'
    });
  });

  it('trims the end when the range starts before the week and ends inside it', () => {
    // 09-01..09-09 → keep only 09-01..09-06
    expect(plan('2026-09-01', '2026-09-09')).toEqual({
      kind: 'trimEnd',
      remainingTo: '2026-09-06'
    });
  });

  it('trims the end when the range ends exactly on the week start', () => {
    expect(plan('2026-09-01', WEEK_START)).toEqual({
      kind: 'trimEnd',
      remainingTo: '2026-09-06'
    });
  });

  it('splits a range that contains the whole week into two rows', () => {
    // 09-01..09-30, week 09-08..09-14 → 09-01..09-07 + 09-15..09-30
    expect(
      planClearAssignmentRange({
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        weekStart: '2026-09-08',
        weekEnd: '2026-09-14'
      })
    ).toEqual({ kind: 'split', leftTo: '2026-09-07', rightFrom: '2026-09-15' });
  });

  it('splits a range that runs one day past each week edge', () => {
    expect(plan('2026-09-06', '2026-09-14')).toEqual({
      kind: 'split',
      leftTo: '2026-09-06',
      rightFrom: '2026-09-14'
    });
  });

  it('does nothing for a range entirely before the week', () => {
    expect(plan('2026-08-01', '2026-08-31')).toEqual({ kind: 'none' });
  });

  it('does nothing for a range entirely after the week', () => {
    expect(plan('2026-09-14', '2026-09-30')).toEqual({ kind: 'none' });
  });

  it('does nothing for a range touching the week start from before', () => {
    // Ends the day before the week starts — no overlap.
    expect(plan('2026-09-01', '2026-09-06')).toEqual({ kind: 'none' });
  });

  it('does nothing for a range touching the week end from after', () => {
    // Starts the day after the week ends — no overlap.
    expect(plan('2026-09-14', '2026-09-20')).toEqual({ kind: 'none' });
  });

  it('does nothing for a single-day range outside the week', () => {
    expect(plan('2026-09-06', '2026-09-06')).toEqual({ kind: 'none' });
    expect(plan('2026-09-14', '2026-09-14')).toEqual({ kind: 'none' });
  });

  it('does nothing for an inverted range (never write an empty range)', () => {
    expect(plan('2026-09-14', '2026-09-07')).toEqual({ kind: 'none' });
  });
});
