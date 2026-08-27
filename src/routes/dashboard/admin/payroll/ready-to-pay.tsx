import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { flexRender } from '@tanstack/react-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { PayQueueSummaryBar, formatPayrollMoney } from './-components';
import { appFeatures, type AppFeatures } from '@/lib/table-features';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { payQueueQueryOptions, type PayQueueFilters } from '@/features/payroll/api/queries';
import { usePayQueueSelection } from '@/features/payroll/api/mutations';
import type { PayQueueRow } from '@/lib/db/payroll';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { useRoleGroupPermissions } from '@/hooks/use-nav';

export const Route = createFileRoute('/dashboard/admin/payroll/ready-to-pay')({
  validateSearch: (search: Record<string, unknown>): { division?: number } => ({
    division:
      typeof search.division === 'string' && /^\d+$/.test(search.division)
        ? Number(search.division)
        : undefined
  }),
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: ReadyToPayPage
});

function selectColumn(t: TFunction): ColumnDef<AppFeatures, PayQueueRow> {
  return {
    id: 'select',
    size: 40,
    header: ({ table }) => {
      const allSelected = table.getIsAllRowsSelected();
      const someSelected = table.getIsSomeRowsSelected();
      return (
        <input
          type='checkbox'
          aria-label={t('payroll.payQueue.selectAll')}
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected === true;
          }}
          onChange={(e) => table.toggleAllRowsSelected(e.target.checked)}
          className='size-4 rounded border'
        />
      );
    },
    cell: ({ row }) => (
      <input
        type='checkbox'
        aria-label={t('payroll.payQueue.selectRow')}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        className='size-4 rounded border'
      />
    )
  };
}

function buildColumns(t: TFunction): ColumnDef<AppFeatures, PayQueueRow>[] {
  return [
    selectColumn(t),
    {
      accessorKey: 'employeeName',
      meta: { label: t('payroll.employee') },
      cell: ({ row }) => (
        <div className='min-w-0'>
          <p className='truncate font-medium'>{row.original.employeeName}</p>
          <p className='truncate text-xs text-muted-foreground'>{row.original.employeeId}</p>
        </div>
      )
    },
    {
      accessorKey: 'departmentName',
      meta: { label: t('payroll.payQueue.division') },
      cell: ({ row }) => row.original.departmentName ?? '-'
    },
    {
      accessorKey: 'periodName',
      meta: { label: t('payroll.period') },
      cell: ({ row }) => (
        <div className='min-w-0'>
          <p className='truncate'>{row.original.periodName}</p>
          <p className='truncate text-xs text-muted-foreground'>
            {row.original.paymentDate ?? `${row.original.periodStart} — ${row.original.periodEnd}`}
          </p>
        </div>
      )
    },
    {
      id: 'bank',
      meta: { label: t('payroll.payQueue.bank') },
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.bankName ? `${row.original.bankName} ${row.original.accountNumber}` : '-'}
        </span>
      )
    },
    {
      accessorKey: 'netSalary',
      meta: { label: t('payroll.net') },
      cell: ({ row }) => (
        <span className='font-semibold tabular-nums'>
          {formatPayrollMoney(row.original.netSalary)}
        </span>
      )
    }
  ];
}

function ReadyToPayPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canPay = canPayrollAction(permissions, isAdmin, 'pay');
  const { division } = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters: PayQueueFilters = useMemo(() => ({ departmentId: division }), [division]);
  const { data, isLoading, isError } = useQuery(payQueueQueryOptions(filters));
  const { data: deptData } = useQuery(departmentsQueryOptions());
  const departments = deptData?.departments ?? [];

  const [rowSelection, setRowSelection] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pay = usePayQueueSelection();

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const columns = useMemo(() => buildColumns(t), [t]);
  const table = useTable({
    features: appFeatures,
    data: rows,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.recordId)
  });

  const selectedIds = Object.keys(rowSelection)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  const selectedRows = rows.filter((row) => selectedIds.includes(row.recordId));
  const selectedNet = selectedRows.reduce((sum, row) => sum + Number(row.netSalary), 0);

  const confirmPay = async () => {
    try {
      const result = (await pay.mutateAsync({
        recordIds: selectedIds
      })) as { stamped: number };
      if (result.stamped < selectedIds.length) {
        // Ticked rows can be skipped when their period left ready_to_pay mid-flight.
        toast.warning(
          t('payroll.payQueue.partialPayWarning', {
            paid: result.stamped,
            requested: selectedIds.length
          })
        );
      } else {
        toast.success(t('payroll.payQueue.paySuccess', { count: result.stamped }));
      }
      setConfirmOpen(false);
      setRowSelection({});
    } catch {
      toast.error(t('payroll.failed'));
    }
  };

  return (
    <PageContainer
      pageTitle={t('payroll.payQueue.title')}
      pageDescription={t('payroll.payQueue.description')}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <NativeSelect
            aria-label={t('payroll.payQueue.division')}
            className='w-full sm:w-64'
            value={division != null ? String(division) : ''}
            onChange={(event) => {
              const next = event.target.value;
              void navigate({
                search: (prev) => ({
                  ...prev,
                  division: next === '' ? undefined : Number(next)
                })
              });
              setRowSelection({});
            }}
          >
            <option value=''>{t('payroll.payQueue.allDivisions')}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            className='sm:ml-auto'
            disabled={!canPay || selectedIds.length === 0 || pay.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {t('payroll.payQueue.paySelected')}
          </Button>
        </div>

        <PayQueueSummaryBar
          t={t}
          totalNet={totals?.totalNet ?? '0'}
          employeeCount={totals?.employeeCount ?? 0}
          selectedCount={selectedIds.length}
          selectedNet={String(selectedNet)}
        />

        {isLoading ? (
          <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
        ) : isError ? (
          <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : rows.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('payroll.payQueue.empty')}</p>
        ) : (
          <div className='rounded-md border'>
            <div className='overflow-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-muted-foreground'>
                  <tr>
                    <th className='w-10 px-2 py-2 text-left font-normal'>
                      <input
                        type='checkbox'
                        aria-label={t('payroll.payQueue.selectAll')}
                        checked={table.getIsAllRowsSelected()}
                        ref={(el) => {
                          if (el) el.indeterminate = table.getIsSomeRowsSelected();
                        }}
                        onChange={(e) => table.toggleAllRowsSelected(e.target.checked)}
                        className='size-4 rounded border'
                      />
                    </th>
                    <th className='px-2 py-2 text-left font-normal'>{t('payroll.employee')}</th>
                    <th className='px-2 py-2 text-left font-normal'>
                      {t('payroll.payQueue.division')}
                    </th>
                    <th className='px-2 py-2 text-left font-normal'>{t('payroll.period')}</th>
                    <th className='px-2 py-2 text-left font-normal'>
                      {t('payroll.payQueue.bank')}
                    </th>
                    <th className='px-2 py-2 text-right font-normal'>{t('payroll.net')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className='border-t'>
                      {row.getVisibleCells().map((cell) => (
                        <td className='px-2 py-2' key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!canPay && rows.length > 0 && (
          <Badge variant='outline' className='w-fit'>
            {t('payroll.payQueue.viewOnlyNotice')}
          </Badge>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('payroll.payQueue.confirmTitle', { count: selectedIds.length })}
        description={`${t('payroll.payQueue.confirmDescription')} ${formatPayrollMoney(
          String(selectedNet)
        )} · ${data?.periods.length ?? 0} ${t('payroll.payQueue.confirmPeriods')}`}
        confirmLabel={t('payroll.payQueue.paySelected')}
        destructive
        onConfirm={() => void confirmPay()}
      />
    </PageContainer>
  );
}
