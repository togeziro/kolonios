import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import RolePermissionsPage from '@/features/role-groups/components/role-permissions-page';
import { roleGroupByIdQueryOptions } from '@/features/role-groups/api/queries';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/role-groups/$id')({
  head: () => ({ meta: [{ title: 'Dashboard: Role Permissions' }] }),
  ssr: 'data-only',
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(roleGroupByIdQueryOptions(params.id));
  },
  component: RolePermissionsRoute
});

function RolePermissionsRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('roleGroups.permissionsPageTitle')}
      pageDescription={t('roleGroups.permissionsPageDescription')}
    >
      <RolePermissionsPage />
    </PageContainer>
  );
}
