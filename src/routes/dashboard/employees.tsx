import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import PageContainer from '@/components/layout/page-container';
import EmployeeListingPage from '@/features/employees/components/employee-listing';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { parseSortingState } from '@/lib/parsers';
import { EmployeeFormSheetTrigger } from '@/features/employees/components/employee-form-sheet';
import { useTranslation } from 'react-i18next';

const employeesSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  department_id: z.number().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getEmployeeFilters(search: Record<string, unknown>) {
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const departmentId = search.department_id as number | undefined;
  const status = search.status as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, [
    'employee_code',
    'full_name',
    'email',
    'department_name',
    'designation_name',
    'phone',
    'status',
    'join_date',
    'created_at',
    'actions'
  ]);

  return {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(departmentId && { department_id: departmentId }),
    ...(status && { status }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };
}

export const Route = createFileRoute('/dashboard/employees')({
  head: () => ({ meta: [{ title: 'Dashboard: Employees' }] }),
  validateSearch: zodValidator(employeesSearchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getEmployeeFilters(deps);
    await queryClient.ensureQueryData(employeesQueryOptions(filters));
  },
  component: EmployeesPage
});

function EmployeesPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('employee.titlePlural')}
      pageDescription={t('employee.pageDescription')}
      pageHeaderAction={<EmployeeFormSheetTrigger />}
    >
      <EmployeeListingPage />
    </PageContainer>
  );
}
