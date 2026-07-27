import { Suspense } from 'react';
import { CustomerTable, CustomerTableSkeleton } from './customer-tables';

export default function CustomerListingPage() {
  return (
    <Suspense fallback={<CustomerTableSkeleton />}>
      <CustomerTable />
    </Suspense>
  );
}
