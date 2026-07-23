import { createFileRoute, Link } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ProductListingPage from '@/features/products/components/product-listing';
import { productsQueryOptions } from '@/features/products/api/queries';
import { parseSortingState } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

const productSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional()
});

function getProductFilters(search: Record<string, unknown>) {
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const category = search.category as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, ['name', 'category', 'price', 'created_at', 'actions']);

  return {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(category && { categories: category }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };
}

export const Route = createFileRoute('/dashboard/product/')({
  head: () => ({ meta: [{ title: 'Dashboard: Products' }] }),
  validateSearch: zodValidator(productSearchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getProductFilters(deps);
    await queryClient.ensureQueryData(productsQueryOptions(filters));
  },
  component: ProductPage
});

function ProductPage() {
  return (
    <PageContainer
      pageTitle='Products'
      pageDescription='Manage products (React Query + search params table pattern.)'
      pageHeaderAction={
        <Link
          to='/dashboard/product/$productId'
          params={{ productId: 'new' }}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <Icons.add className='mr-2 h-4 w-4' /> Add New
        </Link>
      }
    >
      <ProductListingPage />
    </PageContainer>
  );
}
