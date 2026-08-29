import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import PageContainer from '@/components/layout/page-container';
import { CalculatePage } from './-calculate-page';
import { SalaryComponentsPanel } from './-components';

const payrollSearchSchema = z.object({
  tab: z.enum(['calculate', 'ready']).optional()
});

export const Route = createFileRoute('/dashboard/admin/payroll/')({
  validateSearch: (search: Record<string, unknown>) => payrollSearchSchema.parse(search),
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  head: () => ({ meta: [{ title: 'Dashboard: Payroll' }] }),
  component: PayrollOverviewPage
});

/**
 * Kerjoo-style landing page: the tabbed Calculate/Ready-to-Pay UI is the
 * primary surface, with the salary-components CRUD as a sub-section below.
 * Sub-routes (`/generate`, `/ready-to-pay`, `/records`, `/periods`,
 * `/profile`, `/settings`, `/reports`) remain reachable from the sidebar.
 */
function PayrollOverviewPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('payroll.title')}
      pageDescription={t('payroll.overviewDescription')}
    >
      <div className='space-y-6'>
        <CalculatePage />
        <SalaryComponentsPanel />
      </div>
    </PageContainer>
  );
}
