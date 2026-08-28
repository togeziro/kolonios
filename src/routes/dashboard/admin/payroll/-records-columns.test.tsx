// @vitest-environment jsdom
// i18n:skip
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createPayrollRecordColumns, toHoursMinutes } from './-records-columns';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => null
}));

function mockT(): TFunction {
  return ((key: string) => key) as unknown as TFunction;
}

function columnOptions(overrides: Record<string, unknown> = {}) {
  return {
    t: mockT(),
    canApprove: false,
    canPay: false,
    canLock: false,
    canAdjust: false,
    canOverride: false,
    canEditSalary: false,
    onApprove: vi.fn(),
    onPay: vi.fn(),
    onLock: vi.fn(),
    onAdjust: vi.fn(),
    onOverride: vi.fn(),
    onDetail: vi.fn(),
    onEditSalary: vi.fn(),
    ...overrides
  };
}

describe('payroll record columns', () => {
  it('pins the action column and exposes workflow/detail callbacks', () => {
    const columns = createPayrollRecordColumns(columnOptions());
    const actions = columns.find((column) => column.id === 'actions');
    expect(actions?.enablePinning).toBe(true);
    expect(actions?.meta?.label).toBe('payroll.actions');
  });

  it('renders the inline salary editor trigger only when permitted', () => {
    const record = {
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'processing'
    };
    const renderActions = (options: Record<string, unknown>) => {
      const columns = createPayrollRecordColumns(columnOptions(options)) as never as Array<{
        id?: string;
        cell?: (context: { row: { original: unknown } }) => ReactNode;
      }>;
      const actions = columns.find((column) => column.id === 'actions');
      return actions?.cell?.({ row: { original: record } });
    };
    const onEditSalary = vi.fn();
    const { unmount } = render(
      <table>
        <tbody>
          <tr>{renderActions({ canEditSalary: true, onEditSalary })}</tr>
        </tbody>
      </table>
    );
    fireEvent.click(screen.getByRole('button', { name: 'payroll.editBaseSalary' }));
    expect(onEditSalary).toHaveBeenCalledWith(record);
    unmount();
    render(
      <table>
        <tbody>
          <tr>{renderActions({ canEditSalary: false })}</tr>
        </tbody>
      </table>
    );
    expect(screen.queryByRole('button', { name: 'payroll.editBaseSalary' })).toBeNull();
  });

  it('rounds fractional hours to the nearest minute and never carries 60 minutes', () => {
    expect(toHoursMinutes(7.999)).toEqual({ whole: 8, minutes: 0 });
    expect(toHoursMinutes(7.5)).toEqual({ whole: 7, minutes: 30 });
    expect(toHoursMinutes(8)).toEqual({ whole: 8, minutes: 0 });
    expect(toHoursMinutes(40.25)).toEqual({ whole: 40, minutes: 15 });
  });

  it('returns zero hours for null, undefined, or zero', () => {
    expect(toHoursMinutes(null)).toEqual({ whole: 0, minutes: 0 });
    expect(toHoursMinutes(undefined)).toEqual({ whole: 0, minutes: 0 });
    expect(toHoursMinutes(0)).toEqual({ whole: 0, minutes: 0 });
  });

  it('keeps large hour totals', () => {
    expect(toHoursMinutes(160)).toEqual({ whole: 160, minutes: 0 });
  });
});

describe('payroll record per-record paid stamp (ADR-0003)', () => {
  type RecordRow = Parameters<typeof createPayrollRecordColumns>[0] extends infer O
    ? O extends { onDetail: (row: infer R) => void }
      ? R
      : never
    : never;

  function renderStatusCell(row: RecordRow, options: Record<string, unknown> = {}) {
    const columns = createPayrollRecordColumns(
      columnOptions({ canPay: true, ...options })
    ) as never as Array<{
      id?: string;
      accessorKey?: string;
      cell?: (context: { row: { original: RecordRow } }) => ReactNode;
    }>;
    const statusColumn = columns.find((column) => column.accessorKey === 'period_status');
    const statusCell = statusColumn?.cell?.({ row: { original: row } });
    return render(
      <table>
        <tbody>
          <tr>{statusCell}</tr>
        </tbody>
      </table>
    );
  }

  function renderActionsCell(row: RecordRow, options: Record<string, unknown> = {}) {
    const columns = createPayrollRecordColumns(
      columnOptions({ canPay: true, ...options })
    ) as never as Array<{
      id?: string;
      accessorKey?: string;
      cell?: (context: { row: { original: RecordRow } }) => ReactNode;
    }>;
    const actionsColumn = columns.find((column) => column.id === 'actions');
    const actionsCell = actionsColumn?.cell?.({ row: { original: row } });
    return render(
      <table>
        <tbody>
          <tr>{actionsCell}</tr>
        </tbody>
      </table>
    );
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Paid when the record was stamped even if the period is still ready_to_pay', () => {
    const stamped = '2026-08-07T10:00:00.000Z';
    const status = renderStatusCell({
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'ready_to_pay',
      paid_at: stamped,
      paid_by: 'admin-1'
    } as RecordRow);
    expect(status.getByText('payroll.paidLabel')).toBeTruthy();
    expect(status.queryByText('payroll.unpaidLabel')).toBeNull();
  });

  it('renders Paid when the period is paid, even if the record row has no stamp (defensive: period status is sufficient when in paid/locked)', () => {
    // ADR-0003: per-record stamp is the authoritative source for "Paid" in
    // the bulk-pay path (period may stay ready_to_pay). But once the period
    // itself flips to paid/locked, we trust that — an unstamped row in a paid
    // period is a data anomaly, and silently downgrading it to "Unpaid"
    // would be misleading.
    const status = renderStatusCell({
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'paid',
      paid_at: null
    } as RecordRow);
    expect(status.getByText('payroll.paidLabel')).toBeTruthy();
    expect(status.queryByText('payroll.unpaidLabel')).toBeNull();
  });

  it('hides the Pay menu when the record is stamped, even when the period is ready_to_pay', () => {
    const actions = renderActionsCell({
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'ready_to_pay',
      paid_at: '2026-08-07T10:00:00.000Z',
      paid_by: 'admin-1'
    } as RecordRow);
    expect(actions.queryByRole('button', { name: 'payroll.pay' })).toBeNull();
  });

  it('shows the Pay menu when the record is unstamped and the period is ready_to_pay', () => {
    const actions = renderActionsCell({
      payroll_period_id: 1,
      employee_id: 'emp-1',
      period_status: 'ready_to_pay',
      paid_at: null
    } as RecordRow);
    expect(actions.getByRole('button', { name: 'payroll.pay' })).toBeTruthy();
  });
});
