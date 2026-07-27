import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import UserListingPage from '@/features/users/components/user-listing';
import { usersQueryOptions } from '@/features/users/api/queries';
import { parseSortingState } from '@/lib/parsers';
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet';
import { usersInfoContent } from '@/features/users/info-content';

const usersSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  role: z.string().optional(),
  sort: z.string().optional()
});

function getUsersFilters(search: Record<string, unknown>) {
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const role = search.role as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, ['name', 'role', 'created_at', 'actions']);

  return {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(role && { role }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };
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
  return (
    <PageContainer
      pageTitle='Users'
      pageDescription='Manage users (React Query + search params table pattern.)'
      infoContent={usersInfoContent}
      pageHeaderAction={<UserFormSheetTrigger />}
    >
      <UserListingPage />
    </PageContainer>
  );
}
