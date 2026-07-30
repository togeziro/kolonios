import { Suspense } from 'react';
import { ProductTable } from './product-tables';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

export default function ProductListingPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={['h-10', 'h-96', 'h-10']} />}>
      <ProductTable />
    </Suspense>
  );
}
