import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SalaryComponentsPanel } from './-components';

export const Route = createFileRoute('/dashboard/admin/payroll/')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Payroll' }] }),
  component: PayrollOverviewPage
});

const payrollLinks = [
  ['/dashboard/admin/payroll/periods', 'periods'],
  ['/dashboard/admin/payroll/profile', 'profile'],
  ['/dashboard/admin/payroll/generate', 'generate'],
  ['/dashboard/admin/payroll/records', 'records'],
  ['/dashboard/admin/payroll/reports', 'reports']
] as const;

function PayrollOverviewPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('payroll.title')}
      pageDescription={t('payroll.overviewDescription')}
    >
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {payrollLinks.map(([to, key]) => (
          <Card key={to}>
            <CardHeader>
              <CardTitle className='text-base'>{t(`payroll.${key}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant='outline' size='sm'>
                <Link to={to}>{t('common.open')}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <SalaryComponentsPanel />
    </PageContainer>
  );
}
