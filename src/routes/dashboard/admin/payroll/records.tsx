import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/table/data-table';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import {
  payrollKeys,
  payrollPeriodsQueryOptions,
  payrollRecordsQueryOptions
} from '@/features/payroll/api/queries';
import {
  useAdjustPayrollRecord,
  useApprovePayroll,
  useLockPayroll,
  useMarkPayrollPaid,
  useUpsertAttendanceOverride
} from '@/features/payroll/api/mutations';
import { getAttendanceOverrideFn } from '@/features/payroll/api/service';
import type { PayrollRecordFilters, PayrollReportRow } from '@/features/payroll/api/types';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { createPayrollRecordColumns } from './-records-columns';

export const Route = createFileRoute('/dashboard/admin/payroll/records')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: RecordsPage
});

type Adjustment = { name: string; type: 'bonus' | 'deduction'; amount: string; taxable: boolean };
type OverrideDraft = {
  scheduledDays: string;
  payableDays: string;
  workedHours: string;
  permitHours: string;
  shortfallHours: string;
};
const EMPTY_OVERRIDE_DRAFT: OverrideDraft = {
  scheduledDays: '',
  payableDays: '',
  workedHours: '',
  permitHours: '',
  shortfallHours: ''
};

function RecordsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canApprove = canPayrollAction(permissions, isAdmin, 'approve');
  const canPay = canPayrollAction(permissions, isAdmin, 'pay');
  const canLock = canPayrollAction(permissions, isAdmin, 'edit');
  const canAdjust = canPayrollAction(permissions, isAdmin, 'edit');
  const canOverride = canPayrollAction(permissions, isAdmin, 'edit');
  const [filters, setFilters] = useState<PayrollRecordFilters>({ page: 1, limit: 25 });
  const [selected, setSelected] = useState<PayrollReportRow | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<PayrollReportRow | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<OverrideDraft>(EMPTY_OVERRIDE_DRAFT);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [draftAdjustment, setDraftAdjustment] = useState<Adjustment>({
    name: '',
    type: 'bonus',
    amount: '',
    taxable: false
  });
  const periodsQuery = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const departmentsQuery = useQuery(departmentsQueryOptions());
  const recordsQuery = useQuery(payrollRecordsQueryOptions(filters));
  const approve = useApprovePayroll();
  const paid = useMarkPayrollPaid();
  const lock = useLockPayroll();
  const adjust = useAdjustPayrollRecord();
  const upsertOverride = useUpsertAttendanceOverride();
  const overrideQuery = useQuery({
    queryKey: payrollKeys.attendanceOverride(
      overrideTarget?.payroll_period_id ?? 0,
      overrideTarget?.employee_id ?? ''
    ),
    queryFn: () =>
      getAttendanceOverrideFn({
        data: {
          payrollPeriodId: overrideTarget!.payroll_period_id,
          employeeId: overrideTarget!.employee_id
        }
      }),
    enabled: Boolean(overrideTarget)
  });
  const periods = periodsQuery.data?.rows ?? [];
  const records = (recordsQuery.data?.rows ?? []) as PayrollReportRow[];
  const pageCount = Math.max(1, Math.ceil((recordsQuery.data?.total ?? 0) / (filters.limit ?? 25)));
  const updateFilter = (patch: Partial<PayrollRecordFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const run = async (
    action: { mutateAsync: (data: { id: number }) => Promise<unknown> },
    id: number
  ) => {
    try {
      await action.mutateAsync({ id });
      toast.success(t('payroll.updated'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const columns = createPayrollRecordColumns({
    t,
    canApprove,
    canPay,
    canLock,
    canAdjust,
    canOverride,
    onApprove: (id) => void run(approve, id),
    onPay: (id) => void run(paid, id),
    onLock: (id) => void run(lock, id),
    onAdjust: (row) => {
      setSelected(row);
      setAdjustments([]);
    },
    onOverride: (row) => {
      setOverrideTarget(row);
      setOverrideDraft(EMPTY_OVERRIDE_DRAFT);
    },
    onDetail: (row) => {
      setSelected(row);
      setAdjustments([]);
    }
  });
  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      pagination: { pageIndex: (filters.page ?? 1) - 1, pageSize: filters.limit ?? 25 },
      columnPinning: { right: ['actions'] }
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: (filters.page ?? 1) - 1, pageSize: filters.limit ?? 25 })
          : updater;
      setFilters((current) => ({ ...current, page: next.pageIndex + 1, limit: next.pageSize }));
    }
  });
  const addAdjustment = () => {
    if (!draftAdjustment.name.trim() || !draftAdjustment.amount)
      return toast.error(t('payroll.adjustmentRequired'));
    setAdjustments((current) => [...current, draftAdjustment]);
    setDraftAdjustment({ name: '', type: 'bonus', amount: '', taxable: false });
  };
  const saveAdjustments = async () => {
    if (!selected) return;
    try {
      await adjust.mutateAsync({ id: selected.id, adjustments });
      toast.success(t('payroll.updated'));
      setSelected(null);
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  useEffect(() => {
    if (!overrideTarget || !overrideQuery.data) return;
    const row = overrideQuery.data;
    setOverrideDraft({
      scheduledDays: row.scheduled_days != null ? String(row.scheduled_days) : '',
      payableDays: row.payable_days != null ? String(row.payable_days) : '',
      workedHours: row.worked_hours != null ? String(row.worked_hours) : '',
      permitHours: row.permit_hours != null ? String(row.permit_hours) : '',
      shortfallHours: row.shortfall_hours != null ? String(row.shortfall_hours) : ''
    });
  }, [overrideTarget, overrideQuery.data]);
  const saveOverride = async () => {
    if (!overrideTarget) return;
    const values = (field: string) => (field.trim() === '' ? undefined : Number(field));
    try {
      await upsertOverride.mutateAsync({
        payrollPeriodId: overrideTarget.payroll_period_id,
        employeeId: overrideTarget.employee_id,
        scheduledDays: values(overrideDraft.scheduledDays),
        payableDays: values(overrideDraft.payableDays),
        workedHours: values(overrideDraft.workedHours),
        permitHours: values(overrideDraft.permitHours),
        shortfallHours: values(overrideDraft.shortfallHours)
      });
      toast.success(t('payroll.updated'));
      setOverrideTarget(null);
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  return (
    <PageContainer
      pageTitle={t('payroll.records')}
      pageDescription={t('payroll.recordsDescription')}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.records')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 sm:grid-cols-3'>
            <div>
              <Label htmlFor='record-period'>{t('payroll.periods')}</Label>
              <select
                id='record-period'
                className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                value={filters.payrollPeriodId ?? ''}
                onChange={(e) =>
                  updateFilter({
                    payrollPeriodId: e.target.value ? Number(e.target.value) : undefined
                  })
                }
              >
                <option value=''>{t('common.all')}</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor='record-department'>{t('payroll.department')}</Label>
              <select
                id='record-department'
                className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                value={filters.departmentId ?? ''}
                onChange={(e) =>
                  updateFilter({
                    departmentId: e.target.value ? Number(e.target.value) : undefined
                  })
                }
              >
                <option value=''>{t('common.all')}</option>
                {(departmentsQuery.data?.departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor='record-status'>{t('payroll.status')}</Label>
              <select
                id='record-status'
                className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                value={filters.status ?? ''}
                onChange={(e) =>
                  updateFilter({
                    status: (e.target.value || undefined) as PayrollRecordFilters['status']
                  })
                }
              >
                <option value=''>{t('common.all')}</option>
                {['draft', 'processing', 'ready_to_pay', 'paid', 'locked'].map((status) => (
                  <option key={status} value={status}>
                    {t(`payroll.statuses.${status}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {recordsQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
          ) : recordsQuery.isError ? (
            <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
          ) : records.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('payroll.noRecords')}</p>
          ) : (
            <DataTable table={table} />
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('payroll.detailBreakdown')}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className='space-y-4'>
              <div className='grid gap-3 sm:grid-cols-4'>
                {[
                  ['gross', selected.gross_salary],
                  ['allowances', selected.total_allowances],
                  ['deductions', selected.total_deductions],
                  ['net', selected.net_salary]
                ].map(([label, value]) => (
                  <div className='rounded border p-3' key={label as string}>
                    <p className='text-xs text-muted-foreground'>{t(`payroll.${label}`)}</p>
                    <p className='font-semibold'>{String(value)}</p>
                  </div>
                ))}
              </div>
              <p className='text-sm text-muted-foreground'>{t('payroll.adjustmentsHint')}</p>
              {canAdjust && selected.period_status === 'processing' && (
                <>
                  <div className='grid gap-2 sm:grid-cols-4'>
                    <Input
                      aria-label={t('payroll.adjustmentName')}
                      placeholder={t('payroll.adjustmentName')}
                      value={draftAdjustment.name}
                      onChange={(e) =>
                        setDraftAdjustment({ ...draftAdjustment, name: e.target.value })
                      }
                    />
                    <select
                      aria-label={t('payroll.adjustmentType')}
                      className='rounded-md border bg-background px-2 text-sm'
                      value={draftAdjustment.type}
                      onChange={(e) =>
                        setDraftAdjustment({
                          ...draftAdjustment,
                          type: e.target.value as Adjustment['type']
                        })
                      }
                    >
                      <option value='bonus'>{t('payroll.bonus')}</option>
                      <option value='deduction'>{t('payroll.deduction')}</option>
                    </select>
                    <Input
                      aria-label={t('payroll.amount')}
                      value={draftAdjustment.amount}
                      onChange={(e) =>
                        setDraftAdjustment({ ...draftAdjustment, amount: e.target.value })
                      }
                    />
                    <Button type='button' variant='outline' onClick={addAdjustment}>
                      {t('payroll.addAdjustment')}
                    </Button>
                  </div>
                  <ul className='space-y-1 text-sm'>
                    {adjustments.map((adjustment, index) => (
                      <li
                        key={`${adjustment.name}-${index}`}
                        className='flex justify-between border-b py-1'
                      >
                        <span>
                          {t('payroll.adjustmentLabel', {
                            name: adjustment.name,
                            type: adjustment.type
                          })}
                        </span>
                        <span>{adjustment.amount}</span>
                      </li>
                    ))}
                  </ul>
                  <Button onClick={saveAdjustments} disabled={adjust.isPending}>
                    {t('payroll.saveAdjustments')}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(overrideTarget)}
        onOpenChange={(open) => !open && setOverrideTarget(null)}
      >
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('payroll.attendanceOverride')}</DialogTitle>
          </DialogHeader>
          {overrideTarget && (
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>{t('payroll.overrideHint')}</p>
              {overrideQuery.isLoading ? (
                <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
              ) : (
                <div className='grid gap-3 sm:grid-cols-2'>
                  {[
                    ['scheduledDays', t('payroll.scheduledDays')],
                    ['payableDays', t('payroll.payableDays')],
                    ['workedHours', t('payroll.workedHours')],
                    ['permitHours', t('payroll.permitHours')],
                    ['shortfallHours', t('payroll.shortfallHours')]
                  ].map(([field, label]) => (
                    <div key={field}>
                      <Label htmlFor={`override-${field}`}>{label}</Label>
                      <Input
                        id={`override-${field}`}
                        type='number'
                        value={overrideDraft[field as keyof OverrideDraft]}
                        onChange={(e) =>
                          setOverrideDraft((draft) => ({
                            ...draft,
                            [field]: e.target.value
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={saveOverride}
                disabled={
                  upsertOverride.isPending ||
                  overrideQuery.isLoading ||
                  (overrideTarget.period_status !== 'draft' &&
                    overrideTarget.period_status !== 'processing')
                }
              >
                {t('common.save')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
