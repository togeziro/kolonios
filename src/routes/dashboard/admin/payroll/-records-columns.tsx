import type { ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';
import type { TFunction } from 'i18next';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
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
      header: () => <div className='text-center'>{t('payroll.actions')}</div>,
      enablePinning: true,
      size: 56,
      minSize: 56,
      maxSize: 56,
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className='flex justify-center'>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className='flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
                <span className='sr-only'>{t('common.openMenu')}</span>
                <Icons.ellipsis className='h-4 w-4' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuItem onClick={() => options.onDetail(record)}>
                  <Icons.eye className='mr-2 h-4 w-4' />
                  {t('common.view')}
                </DropdownMenuItem>
                {options.canEditSalary && (
                  <DropdownMenuItem onClick={() => options.onEditSalary(record)}>
                    <Icons.edit className='mr-2 h-4 w-4' />
                    {t('payroll.editBaseSalary')}
                  </DropdownMenuItem>
                )}
                {options.canAdjust && record.period_status === 'processing' && (
                  <DropdownMenuItem onClick={() => options.onAdjust(record)}>
                    <Icons.adjustments className='mr-2 h-4 w-4' />
                    {t('payroll.adjust')}
                  </DropdownMenuItem>
                )}
                {options.canOverride &&
                  (record.period_status === 'draft' || record.period_status === 'processing') && (
                    <DropdownMenuItem onClick={() => options.onOverride(record)}>
                      <Icons.clock className='mr-2 h-4 w-4' />
                      {t('payroll.override')}
                    </DropdownMenuItem>
                  )}
                {options.canApprove && record.period_status === 'processing' && (
                  <DropdownMenuItem onClick={() => options.onApprove(record.payroll_period_id)}>
                    <Icons.check className='mr-2 h-4 w-4' />
                    {t('payroll.approve')}
                  </DropdownMenuItem>
                )}
                {options.canPay && record.period_status === 'ready_to_pay' && (
                  <DropdownMenuItem onClick={() => options.onPay(record.payroll_period_id)}>
                    <Icons.creditCard className='mr-2 h-4 w-4' />
                    {t('payroll.pay')}
                  </DropdownMenuItem>
                )}
                {options.canLock && record.period_status === 'paid' && (
                  <DropdownMenuItem onClick={() => options.onLock(record.payroll_period_id)}>
                    <Icons.lock className='mr-2 h-4 w-4' />
                    {t('payroll.lock')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      meta: { label: t('payroll.actions') }
    }
  ];
}
