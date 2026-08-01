import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DepartmentManagePage from '@/features/masterdata/components/department-manage-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/departments')({
  head: () => ({ meta: [{ title: 'Dashboard: Departments' }] }),
  component: DepartmentsPage
});

function DepartmentsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('masterdata.departmentsPageTitle')}
      pageDescription={t('masterdata.departmentsPageDescription')}
    >
      <DepartmentManagePage />
    </PageContainer>
  );
}
