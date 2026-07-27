import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import CustomerListingPage from '@/features/customers/components/customer-listing';
import { customersQueryOptions } from '@/features/customers/api/queries';
import { parseSortingState } from '@/lib/parsers';
import { CustomerFormSheetTrigger } from '@/features/customers/components/customer-form-sheet';

const customersSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getCustomerFilters(search: Record<string, unknown>) {
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const status = search.status as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, [
    'customer_code',
    'full_name',
    'email',
    'status',
    'created_at',
    'actions'
  ]);

  return {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(status && { status }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };
}

export const Route = createFileRoute('/dashboard/customers')({
  head: () => ({ meta: [{ title: 'Dashboard: Customers' }] }),
  validateSearch: zodValidator(customersSearchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getCustomerFilters(deps);
    await queryClient.ensureQueryData(customersQueryOptions(filters));
  },
  component: CustomersPage
});

function CustomersPage() {
  return (
    <PageContainer
      pageTitle='Customers'
      pageDescription='Manage customers (React Query + search params table pattern.)'
      pageHeaderAction={<CustomerFormSheetTrigger />}
    >
      <CustomerListingPage />
    </PageContainer>
  );
}
