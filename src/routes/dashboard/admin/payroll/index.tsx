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
      <div className='space-y-6'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5'>
          {payrollLinks.map(([to, key]) => (
            <Card key={to} className='flex h-full flex-col'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>{t(`payroll.${key}`)}</CardTitle>
              </CardHeader>
              <CardContent className='mt-auto pt-0'>
                <Button asChild variant='outline' size='sm' className='w-full'>
                  <Link to={to}>{t('common.open', { defaultValue: 'Open' })}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <SalaryComponentsPanel />
      </div>
    </PageContainer>
  );
}
