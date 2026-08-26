import type { ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';
import type { TFunction } from 'i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PayrollReportRow } from '@/features/payroll/api/types';
import { formatPayrollMoney } from './-components';

type RecordRow = PayrollReportRow & {
  worked_hours?: number | null;
  has_override?: boolean;
};

export function toHoursMinutes(hours: number | null | undefined): {
  whole: number;
  minutes: number;
} {
  const totalMinutes = Math.round((hours ?? 0) * 60);
  return { whole: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function createPayrollRecordColumns(options: {
  t: TFunction;
  canApprove: boolean;
  canPay: boolean;
  canLock: boolean;
  canAdjust: boolean;
  canOverride: boolean;
  canEditSalary: boolean;
  onApprove: (id: number) => void;
  onPay: (id: number) => void;
  onLock: (id: number) => void;
  onAdjust: (row: RecordRow) => void;
  onOverride: (row: RecordRow) => void;
  onDetail: (row: RecordRow) => void;
  onEditSalary: (row: RecordRow) => void;
}): ColumnDef<AppFeatures, RecordRow>[] {
  const { t } = options;
  return [
    {
      id: 'employee',
      accessorKey: 'employee_name',
      header: t('payroll.employee'),
      cell: ({ row }) => (
        <span className='flex flex-col'>
          <span className='font-medium'>{row.original.employee_name ?? '—'}</span>
          {row.original.employee_code && (
            <span className='text-muted-foreground text-xs'>{row.original.employee_code}</span>
          )}
        </span>
      ),
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
      cell: ({ row }) => {
        const status = row.original.period_status;
        const paid = status === 'paid' || status === 'locked';
        return (
          <Badge variant={paid ? 'default' : 'outline'}>
            {paid ? t('payroll.paidLabel') : t('payroll.unpaidLabel')}
          </Badge>
        );
      },
      meta: { label: t('payroll.status') }
    },
    {
      accessorKey: 'worked_hours',
      header: t('payroll.totalWork'),
      cell: ({ row }) => {
        const { whole, minutes } = toHoursMinutes(row.original.worked_hours);
        return t('payroll.hoursDisplay', { whole, minutes });
      },
      meta: { label: t('payroll.totalWork') }
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
            {options.canEditSalary && (
              <Button size='sm' variant='ghost' onClick={() => options.onEditSalary(record)}>
                {t('payroll.editBaseSalary')}
              </Button>
            )}
            {options.canAdjust && record.period_status === 'processing' && (
              <Button size='sm' variant='ghost' onClick={() => options.onAdjust(record)}>
                {t('payroll.adjust')}
              </Button>
            )}
            {options.canOverride &&
              (record.period_status === 'draft' || record.period_status === 'processing') && (
                <Button size='sm' variant='ghost' onClick={() => options.onOverride(record)}>
                  {t('payroll.override')}
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
