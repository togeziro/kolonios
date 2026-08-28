import type { payrollPeriodStatusEnum } from '@/lib/db/schema/payroll';

export type PayrollPeriodStatus = (typeof payrollPeriodStatusEnum.enumValues)[number];

/**
 * Minimum shape `isRecordPaid` needs to decide whether a payroll record is paid
 * (ADR-0003). Wider shapes (e.g. `PayrollReportRow`, `PaymentHistoryRow`) are
 * assignable to this, so the predicate is reusable from any layer without
 * pulling a feature-level type into `lib/`.
 */
export type PayrollPaidRecordLike = {
  paid_at?: string | null | undefined;
  paid_by?: string | null | undefined;
  period_status?: string | null | undefined;
};

/**
 * Authoritative answer to "is this payroll record paid?" (ADR-0003).
 *
 * The per-record `paid_at` stamp is the contract: it is set by the bulk-pay
 * queue (`stampPayrollRecords`) and the whole-period pay path
 * (`stampUnstampedPayrollRecords`) at the moment the record is paid. The
 * period status (`paid`/`locked`) is a sufficient but not necessary signal:
 * after a partial bulk-pay the period may still be `ready_to_pay` even though
 * individual records are stamped. Conversely, when the period is in a fully
 * paid/locked terminal state, every record is implicitly paid even if a row
 * happens to lack the stamp (data anomaly — downgrading to "Unpaid" would
 * be misleading).
 */
export function isRecordPaid(record: PayrollPaidRecordLike | null | undefined): boolean {
  if (!record) return false;
  return (
    record.paid_at != null || record.period_status === 'paid' || record.period_status === 'locked'
  );
}
