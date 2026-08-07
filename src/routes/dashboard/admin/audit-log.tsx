import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { AuditLogPage } from '@/features/audit/components/audit-log-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/audit-log')({
  head: () => ({ meta: [{ title: 'Dashboard: Audit Log' }] }),
  component: AuditLogRoute
});

function AuditLogRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <DataTableCard title={t('audit.pageTitle')} description={t('audit.pageDescription')}>
        <AuditLogPage />
      </DataTableCard>
    </PageContainer>
  );
}
