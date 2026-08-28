import { describe, expect, it } from 'vitest';
import { isRecordPaid } from './payroll';

describe('isRecordPaid (ADR-0003 per-record stamp predicate)', () => {
  it('returns true when paid_at is set, even if the period is still ready_to_pay', () => {
    // The bug this predicate was extracted to fix: after a partial bulk-pay,
    // the stamped row has paid_at but period_status === 'ready_to_pay'. UI
    // surfaces (records table status badge, payment history, print button)
    // must all read the stamp, not the period status.
    expect(
      isRecordPaid({
        paid_at: '2026-08-07T10:00:00.000Z',
        paid_by: 'admin-1',
        period_status: 'ready_to_pay'
      })
    ).toBe(true);
  });

  it('returns true when paid_at is set on a paid/locked period', () => {
    expect(
      isRecordPaid({
        paid_at: '2026-08-07T10:00:00.000Z',
        paid_by: 'admin-1',
        period_status: 'paid'
      })
    ).toBe(true);
    expect(
      isRecordPaid({
        paid_at: '2026-08-07T10:00:00.000Z',
        paid_by: 'admin-1',
        period_status: 'locked'
      })
    ).toBe(true);
  });

  it('returns true when the period is paid/locked, even without a stamp (defensive)', () => {
    // An unstamped row in a fully-paid period is a data anomaly. The
    // predicate is intentionally OR-semantics so we never silently downgrade
    // a row to "Unpaid" when the period is in a terminal paid state.
    expect(isRecordPaid({ paid_at: null, paid_by: null, period_status: 'paid' })).toBe(true);
    expect(isRecordPaid({ paid_at: null, paid_by: null, period_status: 'locked' })).toBe(true);
  });

  it('returns false for an unstamped record with a non-terminal period status', () => {
    expect(isRecordPaid({ paid_at: null, paid_by: null, period_status: 'ready_to_pay' })).toBe(
      false
    );
    expect(isRecordPaid({ paid_at: null, paid_by: null, period_status: 'processing' })).toBe(false);
    expect(isRecordPaid({ paid_at: null, paid_by: null, period_status: 'draft' })).toBe(false);
  });

  it('returns false when the fields are missing entirely', () => {
    expect(isRecordPaid({})).toBe(false);
    expect(isRecordPaid({ paid_at: undefined, paid_by: undefined })).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isRecordPaid(null)).toBe(false);
    expect(isRecordPaid(undefined)).toBe(false);
  });
});
