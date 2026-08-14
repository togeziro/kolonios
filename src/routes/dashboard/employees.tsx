import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { ColumnVisibilityMenu } from '@/components/ui/table/data-table-view-options';
import { useDataTable } from '@/hooks/use-data-table';
import PageContainer from '@/components/layout/page-container';
import { parseFilters } from '@/lib/filters';
import { parseSortingState } from '@/lib/parsers';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { EmployeeFormSheetTrigger } from '@/features/employees/components/employee-form-sheet';
import { columns } from '@/features/employees/components/employee-tables/columns';
import { STATUS_OPTIONS } from '@/features/employees/components/employee-tables/options';
import type { SearchParams, NavigateWithSearch } from '@/types';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];

const employeesSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  department_id: z.number().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getEmployeeFilters(search: SearchParams) {
  return parseFilters(search, {
    sortColumns: [
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
    ],
    fieldMappings: { department_id: 'department_id' }
  });
}

export const Route = createFileRoute('/dashboard/employees')({
  head: () => ({ meta: [{ title: 'Dashboard: Employees' }] }),
  validateSearch: zodValidator(employeesSearchSchema),
  ssr: 'data-only',
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getEmployeeFilters(deps);
    await queryClient.ensureQueryData(employeesQueryOptions(filters));
  },
  component: EmployeesPage
});

function EmployeesPage() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as SearchParams;
  const navigate = useNavigate() as unknown as NavigateWithSearch;

  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const status = search.status as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, columnIds);

  const filters = {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(status && { status }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };

  const { data } = useSuspenseQuery(employeesQueryOptions(filters));
  const pageCount = Math.max(1, Math.ceil(data.total_employees / perPage));

  const { table } = useDataTable({
    data: data.employees,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { start: [], end: ['actions'] }
    }
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  function setColumnSelectFilter(columnId: string, value: string | null) {
    void navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        page: 1,
        [columnId]: value ?? undefined
      }),
      replace: true
    });
  }

  const toolbar = (
    <div className='flex flex-wrap items-center gap-2'>
      <InputGroup className='h-7 w-full md:w-64'>
        <InputGroupAddon align='inline-start'>
          <Search className='size-3.5' />
        </InputGroupAddon>
        <InputGroupInput
          className='h-7'
          placeholder={t('employee.searchPlaceholder')}
          value={name ?? ''}
          onChange={(event) => setColumnSelectFilter('name', event.target.value || null)}
        />
      </InputGroup>
      <ColumnVisibilityMenu
        table={table}
        trigger={
          <Button variant='outline' size='sm'>
            <SlidersHorizontal /> {t('table.hide')}
          </Button>
        }
      />
      <ColumnVisibilityMenu
        table={table}
        trigger={
          <Button variant='outline' size='sm'>
            <SlidersHorizontal /> {t('table.customize')}
          </Button>
        }
      />
      <EmployeeFormSheetTrigger />
    </div>
  );

  return (
    <PageContainer>
      <DataTableCard
        title={t('employee.titlePlural')}
        description={t('employee.pageDescription')}
        action={toolbar}
      >
        <div className='flex flex-wrap items-center justify-between gap-3 px-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Select
              value={status ?? 'All'}
              onValueChange={(value) =>
                setColumnSelectFilter('status', value === 'All' ? null : value)
              }
            >
              <SelectTrigger size='sm'>
                <span className='text-muted-foreground'>{t('employee.status')}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align='start'>
                <SelectGroup>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='flex items-center justify-between gap-3 px-4'>
          <div className='text-muted-foreground text-sm tabular-nums'>
            {t('table.selectedCount', { count: selectedCount })}
          </div>
        </div>

        <DataTable table={table} />
      </DataTableCard>
    </PageContainer>
  );
}
