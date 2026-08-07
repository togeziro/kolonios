import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import RoleGroupListingPage from '@/features/role-groups/components/role-group-listing';
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
    <PageContainer>
      <RoleGroupListingPage />
    </PageContainer>
  );
}
