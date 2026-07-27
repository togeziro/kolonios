import { Suspense } from 'react';
import { EmployeeTable, EmployeeTableSkeleton } from './employee-tables';

export default function EmployeeListingPage() {
  return (
    <Suspense fallback={<EmployeeTableSkeleton />}>
      <EmployeeTable />
    </Suspense>
  );
}
