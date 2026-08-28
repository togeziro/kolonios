// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentHistoryCard, type PaymentHistoryRow } from './-profile-payment-history';

function renderCard(rows: PaymentHistoryRow[]) {
  return render(<PaymentHistoryCard paymentHistory={rows} />);
}

describe('employee payment history card (ADR-0003 per-record paid_at)', () => {
  it('renders Paid when the record was stamped, even when the period is still ready_to_pay', () => {
    renderCard([
      {
        id: 1,
        period_name: 'Payroll Juli 2026',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        payment_date: '2026-08-07',
        net_salary: '4500000',
        period_status: 'ready_to_pay',
        paid_at: '2026-08-07T10:00:00.000Z',
        paid_by: 'admin-1'
      }
    ]);
    expect(screen.getByText('payroll.paidLabel')).toBeTruthy();
    expect(screen.queryByText('payroll.unpaidLabel')).toBeNull();
  });

  it('renders Paid when the period is paid, even if the record row has no stamp (defensive: period status is sufficient when in paid/locked)', () => {
    // ADR-0003: per-record stamp is the authoritative source for "Paid" in
    // the bulk-pay path (period may stay ready_to_pay). But once the period
    // itself flips to paid/locked, we trust that — an unstamped row in a paid
    // period is a data anomaly, and silently downgrading it to "Unpaid"
    // would be misleading.
    renderCard([
      {
        id: 2,
        period_name: 'Payroll Juni 2026',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        payment_date: '2026-07-07',
        net_salary: '4500000',
        period_status: 'paid',
        paid_at: null,
        paid_by: null
      }
    ]);
    expect(screen.getByText('payroll.paidLabel')).toBeTruthy();
    expect(screen.queryByText('payroll.unpaidLabel')).toBeNull();
  });

  it('renders Unpaid for an unstamped record with a ready_to_pay period', () => {
    renderCard([
      {
        id: 3,
        period_name: 'Payroll Agustus 2026',
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        payment_date: '2026-09-07',
        net_salary: '4500000',
        period_status: 'ready_to_pay',
        paid_at: null,
        paid_by: null
      }
    ]);
    expect(screen.queryByText('payroll.paidLabel')).toBeNull();
    expect(screen.getByText('payroll.unpaidLabel')).toBeTruthy();
  });
});
