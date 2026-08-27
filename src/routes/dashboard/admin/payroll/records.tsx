import { useState } from 'react';
import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import { useTable } from '@tanstack/react-table';
import { appFeatures } from '@/lib/table-features';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import {
  employeePayrollProfileQueryOptions,
  payrollKeys,
  payrollPeriodsQueryOptions,
  payrollRecordsQueryOptions
} from '@/features/payroll/api/queries';
import {
  useAdjustPayrollRecord,
  useAlignBaseSalary,
  useApprovePayroll,
  useLockPayroll,
  useMarkPayrollPaid,
  useUpdateEmployeePayrollProfile,
  useUpsertAttendanceOverride
} from '@/features/payroll/api/mutations';
import { getAttendanceOverrideFn } from '@/features/payroll/api/service';
import {
  PAYROLL_PERIOD_STATUSES,
  type PayrollRecordFilters,
  type PayrollReportRow
} from '@/features/payroll/api/types';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import {
  AttendanceOverrideDialog,
  draftToOverrideValues,
  type OverrideDraft
} from './-override-dialog';
import { BaseSalaryDialog, draftToBaseSalaryValues } from './-base-salary-dialog';
import { createPayrollRecordColumns } from './-records-columns';

export const Route = createFileRoute('/dashboard/admin/payroll/records')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: RecordsPage
});

type Adjustment = { name: string; type: 'bonus' | 'deduction'; amount: string; taxable: boolean };

function RecordsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canApprove = canPayrollAction(permissions, isAdmin, 'approve');
  const canPay = canPayrollAction(permissions, isAdmin, 'pay');
  const canLock = canPayrollAction(permissions, isAdmin, 'edit');
  const canAdjust = canPayrollAction(permissions, isAdmin, 'edit');
  const canOverride = canPayrollAction(permissions, isAdmin, 'edit');
  const canEditSalary = canPayrollAction(permissions, isAdmin, 'edit');
  const [filters, setFilters] = useState<PayrollRecordFilters>({ page: 1, limit: 25 });
  const [selected, setSelected] = useState<PayrollReportRow | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<PayrollReportRow | null>(null);
  const [salaryTarget, setSalaryTarget] = useState<PayrollReportRow | null>(null);
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
  const updateProfile = useUpdateEmployeePayrollProfile();
  const alignBaseSalary = useAlignBaseSalary();
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
  const salaryProfileQuery = useQuery({
    ...employeePayrollProfileQueryOptions(salaryTarget?.employee_id ?? ''),
    enabled: Boolean(salaryTarget)
  });
  const employeesQuery = useQuery(employeesQueryOptions({ limit: 200 }));
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
    canEditSalary,
    onApprove: (id) => void run(approve, id),
    onPay: (id) => void run(paid, id),
    onLock: (id) => void run(lock, id),
    onAdjust: (row) => {
      setSelected(row);
      setAdjustments([]);
    },
    onOverride: (row) => {
      setOverrideTarget(row);
    },
    onDetail: (row) => {
      setSelected(row);
      setAdjustments([]);
    },
    onEditSalary: (row) => {
      setSalaryTarget(row);
    }
  });
  const table = useTable({
    data: records,
    columns,
    features: appFeatures,
    manualPagination: true,
    pageCount,
    state: {
      pagination: { pageIndex: (filters.page ?? 1) - 1, pageSize: filters.limit ?? 25 },
      columnPinning: { start: [], end: ['actions'] }
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
  const saveOverride = async (draft: OverrideDraft) => {
    if (!overrideTarget) return;
    try {
      await upsertOverride.mutateAsync({
        payrollPeriodId: overrideTarget.payroll_period_id,
        employeeId: overrideTarget.employee_id,
        ...draftToOverrideValues(draft)
      });
      toast.success(t('payroll.updated'));
      setOverrideTarget(null);
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const matches = useMatches();
  const isPrint = matches.some((m) => m.routeId === '/dashboard/admin/payroll/records/$id/print');
  if (isPrint) return <Outlet />;
  return (
    <PageContainer>
      <DataTableCard title={t('payroll.records')}>
        <div className='grid gap-3 px-4 sm:grid-cols-3'>
          <div>
            <Label htmlFor='record-period'>{t('payroll.periods')}</Label>
            <NativeSelect
              id='record-period'
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
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor='record-department'>{t('payroll.department')}</Label>
            <NativeSelect
              id='record-department'
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
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor='record-status'>{t('payroll.status')}</Label>
            <NativeSelect
              id='record-status'
              value={filters.status ?? ''}
              onChange={(e) =>
                updateFilter({
                  status: (e.target.value || undefined) as PayrollRecordFilters['status']
                })
              }
            >
              <option value=''>{t('common.all')}</option>
              {PAYROLL_PERIOD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`payroll.statuses.${status}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {recordsQuery.isLoading ? (
          <p className='px-4 text-sm text-muted-foreground'>{t('common.loading')}</p>
        ) : recordsQuery.isError ? (
          <p className='px-4 text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : records.length === 0 ? (
          <p className='px-4 text-sm text-muted-foreground'>{t('payroll.noRecords')}</p>
        ) : (
          <DataTable table={table} />
        )}
      </DataTableCard>
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
              {(selected.period_status === 'paid' || selected.period_status === 'locked') && (
                <Button variant='outline' asChild>
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                  <Link
                    to='/dashboard/admin/payroll/records/$id/print'
                    params={{ id: String(selected.id) }}
                    search={{ start: selected.period_start, end: selected.period_end }}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={() => setSelected(null)}
                  >
                    {t('payroll.print')}
                  </Link>
                </Button>
              )}
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
                    <NativeSelect
                      aria-label={t('payroll.adjustmentType')}
                      className='px-2'
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
                    </NativeSelect>
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
      <AttendanceOverrideDialog
        open={Boolean(overrideTarget)}
        periodStatus={overrideTarget?.period_status ?? 'draft'}
        row={overrideQuery.data ?? null}
        isLoading={overrideQuery.isLoading}
        isError={overrideQuery.isError}
        isSaving={upsertOverride.isPending}
        onSave={saveOverride}
        onOpenChange={(open) => !open && setOverrideTarget(null)}
        t={t}
      />
      <BaseSalaryDialog
        open={Boolean(salaryTarget)}
        employeeName={salaryTarget?.employee_name ?? undefined}
        profile={salaryProfileQuery.data ?? null}
        employees={(employeesQuery.data?.employees ?? [])
          .filter((employee) => employee.id !== salaryTarget?.employee_id)
          .map((employee) => ({ id: employee.id, full_name: employee.full_name }))}
        isLoading={salaryProfileQuery.isLoading}
        isError={salaryProfileQuery.isError}
        isSaving={updateProfile.isPending || alignBaseSalary.isPending}
        canEdit={canEditSalary}
        onSave={async (draft) => {
          if (!salaryTarget) return;
          try {
            await updateProfile.mutateAsync(
              draftToBaseSalaryValues(draft, salaryTarget.employee_id)
            );
            toast.success(t('payroll.updated'));
          } catch {
            toast.error(t('payroll.failed'));
          }
        }}
        onAlign={async (targetIds) => {
          if (!salaryTarget) return;
          try {
            await alignBaseSalary.mutateAsync({
              sourceEmployeeId: salaryTarget.employee_id,
              targetEmployeeIds: targetIds
            });
            toast.success(t('payroll.updated'));
          } catch {
            toast.error(t('payroll.failed'));
          }
        }}
        onOpenChange={(open) => !open && setSalaryTarget(null)}
        t={t}
      />
    </PageContainer>
  );
}
