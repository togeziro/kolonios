import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import UserListingPage from '@/features/users/components/user-listing';
import { usersQueryOptions } from '@/features/users/api/queries';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { useTranslation } from 'react-i18next';
import { parseFilters } from '@/lib/filters';
import type { SearchParams } from '@/types';

const usersSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getUsersFilters(search: SearchParams) {
  return parseFilters(search, {
    sortColumns: ['name', 'role', 'created_at', 'actions'],
    fieldMappings: { role: 'role' }
  });
}

export const Route = createFileRoute('/dashboard/users')({
  head: () => ({ meta: [{ title: 'Dashboard: Users' }] }),
  validateSearch: zodValidator(usersSearchSchema),
  ssr: 'data-only',
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getUsersFilters(deps);
    await queryClient.ensureQueryData(usersQueryOptions(filters));
  },
  component: UsersPage
});

function UsersPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <DataTableCard title={t('user.titlePlural')} description={t('user.pageDescription')}>
        <UserListingPage />
      </DataTableCard>
    </PageContainer>
  );
}
