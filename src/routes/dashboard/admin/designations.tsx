import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DesignationManagePage from '@/features/masterdata/components/designation-manage-page';

export const Route = createFileRoute('/dashboard/admin/designations')({
  head: () => ({ meta: [{ title: 'Dashboard: Job Titles' }] }),
  component: () => (
    <PageContainer
      pageTitle='Job Title Management'
      pageDescription='Add, edit, and manage job titles/designations'
    >
      <DesignationManagePage />
    </PageContainer>
  )
});
