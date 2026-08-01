import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { AuditLogPage } from '@/features/audit/components/audit-log-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/audit-log')({
  head: () => ({ meta: [{ title: 'Dashboard: Audit Log' }] }),
  component: AuditLogRoute
});

function AuditLogRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer pageTitle={t('audit.pageTitle')} pageDescription={t('audit.pageDescription')}>
      <AuditLogPage />
    </PageContainer>
  );
}
