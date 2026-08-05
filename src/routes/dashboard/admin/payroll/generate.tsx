import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { payrollPeriodsQueryOptions } from '@/features/payroll/api/queries';
import { useGeneratePayroll } from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import {
  EMPLOYEE_QUERY_LIMIT_MAX,
  isEmployeeQueryTruncated
} from '@/features/employees/api/validation';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';

export const Route = createFileRoute('/dashboard/admin/payroll/generate')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.edit' });
  },
  component: GeneratePage
});

function GeneratePage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const periodsQuery = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const employeesQuery = useQuery(
    employeesQueryOptions({ page: 1, limit: EMPLOYEE_QUERY_LIMIT_MAX, status: 'active' })
  );
  const periods = periodsQuery.data?.rows ?? [];
  const [periodId, setPeriodId] = useState('');
  const generate = useGeneratePayroll();
  const selectedPeriod = periods.find((period) => period.id === Number(periodId));
  const run = async () => {
    if (!canEdit || !periodId) return toast.error(t('payroll.selectPeriod'));
    try {
      await generate.mutateAsync({ payrollPeriodId: Number(periodId) });
      toast.success(t('payroll.generated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.failed'));
    }
  };
  return (
    <PageContainer
      pageTitle={t('payroll.generate')}
      pageDescription={t('payroll.generateDescription')}
    >
      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle>{t('payroll.calculationPreview')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {periodsQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('payroll.loadingPeriods')}</p>
          ) : periodsQuery.isError ? (
            <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
          ) : !periods.length ? (
            <p className='text-sm text-muted-foreground'>{t('payroll.noPeriods')}</p>
          ) : null}
          <div className='space-y-1'>
            <label htmlFor='payroll-period' className='text-sm font-medium'>
              {t('payroll.periods')}
            </label>
            <select
              id='payroll-period'
              className='w-full rounded-md border bg-background px-3 py-2 text-sm'
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value=''>{t('payroll.selectPeriod')}</option>
              {periods
                .filter((period) => period.status === 'draft')
                .map((period) => (
                  <option key={period.id} value={period.id}>
                    {t('payroll.periodOption', {
                      name: period.name,
                      start: period.period_start,
                      end: period.period_end
                    })}
                  </option>
                ))}
            </select>
          </div>
          {selectedPeriod && (
            <div className='grid gap-3 rounded-lg border p-4 sm:grid-cols-3'>
              <div>
                <p className='text-xs text-muted-foreground'>{t('payroll.employeeCount')}</p>
                <p className='text-xl font-semibold'>
                  {employeesQuery.isLoading ? '...' : (employeesQuery.data?.total_employees ?? 0)}
                </p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>{t('payroll.periods')}</p>
                <p>
                  {selectedPeriod.period_start} - {selectedPeriod.period_end}
                </p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>{t('payroll.paymentDate')}</p>
                <p>{selectedPeriod.payment_date}</p>
              </div>
            </div>
          )}
          {employeesQuery.isError && (
            <p className='text-sm text-destructive'>{t('payroll.employeeLoadFailed')}</p>
          )}
          {isEmployeeQueryTruncated(employeesQuery.data?.total_employees) && (
            <p className='text-sm text-amber-600'>
              {t('payroll.employeeLimitWarning', { count: EMPLOYEE_QUERY_LIMIT_MAX })}
            </p>
          )}
          {generate.isError && (
            <p className='text-sm text-destructive'>
              {generate.error instanceof Error ? generate.error.message : t('payroll.missingData')}
            </p>
          )}
          <p className='text-sm text-muted-foreground'>{t('payroll.generateHint')}</p>
          <Button
            onClick={run}
            disabled={
              !canEdit || generate.isPending || periodsQuery.isLoading || employeesQuery.isLoading
            }
          >
            {generate.isPending ? t('payroll.generating') : t('payroll.generate')}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
