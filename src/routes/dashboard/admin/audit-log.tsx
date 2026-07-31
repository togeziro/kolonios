import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { AuditLogPage } from '@/features/audit/components/audit-log-page';

export const Route = createFileRoute('/dashboard/admin/audit-log')({
  head: () => ({ meta: [{ title: 'Dashboard: Audit Log' }] }),
  component: () => (
    <PageContainer
      pageTitle='Audit Log'
      pageDescription='Record of administrative actions (who changed what and when)'
    >
      <AuditLogPage />
    </PageContainer>
  )
});
