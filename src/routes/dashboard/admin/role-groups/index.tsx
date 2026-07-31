import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import RoleGroupListingPage from '@/features/role-groups/components/role-group-listing';
import { RoleGroupFormSheetTrigger } from '@/features/role-groups/components/role-group-form-sheet';
import { roleGroupsQueryOptions } from '@/features/role-groups/api/queries';

export const Route = createFileRoute('/dashboard/admin/role-groups/')({
  head: () => ({ meta: [{ title: 'Dashboard: Role Groups' }] }),
  ssr: 'data-only',
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(roleGroupsQueryOptions());
  },
  component: RoleGroupsPage
});

function RoleGroupsPage() {
  return (
    <PageContainer
      pageTitle='Role Groups'
      pageDescription='Manage role groups and configure module-level access permissions'
      pageHeaderAction={<RoleGroupFormSheetTrigger />}
    >
      <RoleGroupListingPage />
    </PageContainer>
  );
}
