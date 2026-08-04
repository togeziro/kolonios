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

export const Route = createFileRoute('/dashboard/admin/payroll/generate')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.edit' });
  },
  component: GeneratePage
});
function GeneratePage() {
  const { t } = useTranslation();
  const { data: response } = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const data = Array.isArray(response) ? response : (response?.rows ?? []);
  const generate = useGeneratePayroll();
  const [periodId, setPeriodId] = useState('');
  const run = async () => {
    if (!periodId) return toast.error(t('payroll.selectPeriod'));
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
              {(data ?? [])
                .filter((p: any) => p.status === 'draft')
                .map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.period_start} - {p.period_end})
                  </option>
                ))}
            </select>
          </div>
          <p className='text-sm text-muted-foreground'>{t('payroll.generateHint')}</p>
          <Button onClick={run} disabled={generate.isPending}>
            {generate.isPending ? t('payroll.generating') : t('payroll.generate')}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
