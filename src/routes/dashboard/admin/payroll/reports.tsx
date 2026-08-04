import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  payrollPeriodsQueryOptions,
  payrollReportQueryOptions
} from '@/features/payroll/api/queries';
import { getPayrollReportFn } from '@/features/payroll/api/service';

export const Route = createFileRoute('/dashboard/admin/payroll/reports')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.reports' });
  },
  component: ReportsPage
});
function ReportsPage() {
  const { t } = useTranslation();
  const [periodId, setPeriodId] = useState('');
  const { data: periodsResponse } = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const periods = Array.isArray(periodsResponse) ? periodsResponse : (periodsResponse?.rows ?? []);
  const { data, isLoading } = useQuery(
    payrollReportQueryOptions({
      payrollPeriodId: periodId ? Number(periodId) : undefined,
      format: 'json',
      page: 1,
      limit: 100
    } as any)
  );
  const exportMutation = useMutation({
    mutationFn: () =>
      getPayrollReportFn({
        data: { payrollPeriodId: periodId ? Number(periodId) : undefined, format: 'csv' } as any
      }),
    onSuccess: (result: any) => {
      if (!result?.content) return;
      const blob = new Blob([result.content], { type: result.mime ?? 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payroll-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  });
  const rows = (data as any)?.rows ?? [];
  const total = rows.reduce(
    (acc: any, row: any) => ({
      gross: acc.gross + Number(row.gross_salary ?? 0),
      allowances: acc.allowances + Number(row.total_allowances ?? 0),
      deductions: acc.deductions + Number(row.total_deductions ?? 0),
      net: acc.net + Number(row.net_salary ?? 0)
    }),
    { gross: 0, allowances: 0, deductions: 0, net: 0 }
  );
  return (
    <PageContainer
      pageTitle={t('payroll.reports')}
      pageDescription={t('payroll.reportsDescription')}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.reports')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            <select
              className='rounded-md border bg-background px-3 py-2 text-sm'
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
            <Button
              variant='outline'
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {t('payroll.exportCsv')}
            </Button>
          </div>
          {isLoading ? (
            <p>{t('common.loading')}</p>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              {[
                ['gross', t('payroll.gross')],
                ['allowances', t('payroll.allowances')],
                ['deductions', t('payroll.deductions')],
                ['net', t('payroll.net')]
              ].map(([key, label]) => (
                <div className='rounded-lg border p-4' key={key}>
                  <p className='text-sm text-muted-foreground'>{label}</p>
                  <p className='text-xl font-semibold'>
                    {Number((total as any)[key]).toLocaleString('en-US', {
                      minimumFractionDigits: 2
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className='text-xs text-muted-foreground'>{t('payroll.reportScopeHint')}</p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
