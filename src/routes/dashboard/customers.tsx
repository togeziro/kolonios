import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import CustomerListingPage from '@/features/customers/components/customer-listing';
import { customersQueryOptions } from '@/features/customers/api/queries';
import { CustomerFormSheetTrigger } from '@/features/customers/components/customer-form-sheet';
import { useTranslation } from 'react-i18next';
import { parseFilters } from '@/lib/filters';
import type { SearchParams } from '@/types';

const customersSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getCustomerFilters(search: SearchParams) {
  return parseFilters(search, {
    sortColumns: ['customer_code', 'full_name', 'email', 'status', 'created_at', 'actions']
  });
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
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('customer.titlePlural')}
      pageDescription={t('customer.pageDescription')}
      pageHeaderAction={<CustomerFormSheetTrigger />}
    >
      <CustomerListingPage />
    </PageContainer>
  );
}
