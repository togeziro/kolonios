import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  payrollPeriodsQueryOptions,
  payrollRecordsQueryOptions
} from '@/features/payroll/api/queries';
import {
  useApprovePayroll,
  useLockPayroll,
  useMarkPayrollPaid
} from '@/features/payroll/api/mutations';
import { formatPayrollMoney } from './components';

export const Route = createFileRoute('/dashboard/admin/payroll/records')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: RecordsPage
});
function RecordsPage() {
  const { t } = useTranslation();
  const [periodId, setPeriodId] = useState('');
  const [status, setStatus] = useState('');
  const { data: periodsResponse } = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const periods = Array.isArray(periodsResponse) ? periodsResponse : (periodsResponse?.rows ?? []);
  const { data, isLoading } = useQuery(
    payrollRecordsQueryOptions({
      payrollPeriodId: periodId ? Number(periodId) : undefined,
      status: (status || undefined) as any,
      page: 1,
      limit: 100
    })
  );
  const approve = useApprovePayroll();
  const paid = useMarkPayrollPaid();
  const lock = useLockPayroll();
  const run = async (action: any, id: number) => {
    try {
      await action.mutateAsync({ id });
      toast.success(t('payroll.updated'));
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
          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-sm font-medium'>{t('payroll.periods')}</label>
              <select
                className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value=''>{t('common.all')}</option>
                {(periods ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='text-sm font-medium'>{t('payroll.status')}</label>
              <select
                className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value=''>{t('common.all')}</option>
                {['draft', 'processing', 'ready_to_pay', 'paid', 'locked'].map((s) => (
                  <option key={s} value={s}>
                    {t(`payroll.statuses.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {isLoading ? (
            <p>{t('common.loading')}</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b text-left'>
                    <th className='p-2'>{t('payroll.employee')}</th>
                    <th className='p-2'>{t('payroll.gross')}</th>
                    <th className='p-2'>{t('payroll.deductions')}</th>
                    <th className='p-2'>{t('payroll.net')}</th>
                    <th className='p-2'>{t('payroll.status')}</th>
                    <th className='p-2 text-right'>{t('payroll.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((row: any) => (
                    <tr className='border-b' key={row.id}>
                      <td className='p-2'>{row.employee_id}</td>
                      <td className='p-2'>{formatPayrollMoney(row.gross_salary)}</td>
                      <td className='p-2'>{formatPayrollMoney(row.total_deductions)}</td>
                      <td className='p-2 font-medium'>{formatPayrollMoney(row.net_salary)}</td>
                      <td className='p-2'>
                        <Badge variant='outline'>
                          {t(`payroll.statuses.${row.period_status}`)}
                        </Badge>
                      </td>
                      <td className='p-2 text-right'>
                        <div className='flex flex-wrap justify-end gap-1'>
                          {row.period_status === 'processing' && (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => run(approve, row.payroll_period_id)}
                            >
                              {t('payroll.approve')}
                            </Button>
                          )}
                          {row.period_status === 'ready_to_pay' && (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => run(paid, row.payroll_period_id)}
                            >
                              {t('payroll.pay')}
                            </Button>
                          )}
                          {row.period_status === 'paid' && (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => run(lock, row.payroll_period_id)}
                            >
                              {t('payroll.lock')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className='text-xs text-muted-foreground'>{t('payroll.adjustmentsHint')}</p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
