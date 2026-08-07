import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DepartmentManagePage from '@/features/masterdata/components/department-manage-page';

export const Route = createFileRoute('/dashboard/admin/departments')({
  head: () => ({ meta: [{ title: 'Dashboard: Departments' }] }),
  component: DepartmentsPage
});

function DepartmentsPage() {
  return (
    <PageContainer>
      <DepartmentManagePage />
    </PageContainer>
  );
}
