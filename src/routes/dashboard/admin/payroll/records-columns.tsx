import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PayrollReportRow } from '@/features/payroll/api/types';
import { formatPayrollMoney } from './components';

type RecordRow = PayrollReportRow;

export function createPayrollRecordColumns(options: {
  t: TFunction;
  canApprove: boolean;
  canPay: boolean;
  canLock: boolean;
  canAdjust: boolean;
  onApprove: (id: number) => void;
  onPay: (id: number) => void;
  onLock: (id: number) => void;
  onAdjust: (row: RecordRow) => void;
  onDetail: (row: RecordRow) => void;
}): ColumnDef<RecordRow>[] {
  const { t } = options;
  return [
    {
      accessorKey: 'employee_id',
      header: t('payroll.employee'),
      meta: { label: t('payroll.employee') }
    },
    {
      accessorKey: 'gross_salary',
      header: t('payroll.gross'),
      cell: ({ row }) => formatPayrollMoney(row.original.gross_salary),
      meta: { label: t('payroll.gross') }
    },
    {
      accessorKey: 'total_allowances',
      header: t('payroll.allowances'),
      cell: ({ row }) => formatPayrollMoney(row.original.total_allowances),
      meta: { label: t('payroll.allowances') }
    },
    {
      accessorKey: 'total_deductions',
      header: t('payroll.deductions'),
      cell: ({ row }) => formatPayrollMoney(row.original.total_deductions),
      meta: { label: t('payroll.deductions') }
    },
    {
      accessorKey: 'net_salary',
      header: t('payroll.net'),
      cell: ({ row }) => formatPayrollMoney(row.original.net_salary),
      meta: { label: t('payroll.net') }
    },
    {
      accessorKey: 'period_status',
      header: t('payroll.status'),
      cell: ({ row }) => (
        <Badge variant='outline'>{t(`payroll.statuses.${row.original.period_status}`)}</Badge>
      ),
      meta: { label: t('payroll.status') }
    },
    {
      id: 'actions',
      header: t('payroll.actions'),
      enablePinning: true,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className='flex justify-end gap-1'>
            <Button size='sm' variant='ghost' onClick={() => options.onDetail(record)}>
              {t('common.view')}
            </Button>
            {options.canAdjust && record.period_status === 'processing' && (
              <Button size='sm' variant='ghost' onClick={() => options.onAdjust(record)}>
                {t('payroll.adjust')}
              </Button>
            )}
            {options.canApprove && record.period_status === 'processing' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => options.onApprove(record.payroll_period_id)}
              >
                {t('payroll.approve')}
              </Button>
            )}
            {options.canPay && record.period_status === 'ready_to_pay' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => options.onPay(record.payroll_period_id)}
              >
                {t('payroll.pay')}
              </Button>
            )}
            {options.canLock && record.period_status === 'paid' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => options.onLock(record.payroll_period_id)}
              >
                {t('payroll.lock')}
              </Button>
            )}
          </div>
        );
      },
      meta: { label: t('payroll.actions') }
    }
  ];
}
