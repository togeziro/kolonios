import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import ProductViewPage from '@/features/products/components/product-view-page';
import { productByIdQueryOptions } from '@/features/products/api/queries';

export const Route = createFileRoute('/dashboard/product/$productId')({
  head: () => ({ meta: [{ title: 'Dashboard : Product View' }] }),
  loader: async ({ context: { queryClient }, params }) => {
    if (params.productId !== 'new') {
      await queryClient.ensureQueryData(productByIdQueryOptions(Number(params.productId)));
    }
  },
  component: ProductDetailPage
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <ProductViewPage productId={productId} />
      </div>
    </PageContainer>
  );
}
