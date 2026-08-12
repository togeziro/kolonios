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
import { customersQueryOptions } from '@/features/customers/api/queries';
import { CustomerFormSheetTrigger } from '@/features/customers/components/customer-form-sheet';
import { columns } from '@/features/customers/components/customer-tables/columns';
import { STATUS_OPTIONS } from '@/features/customers/components/customer-tables/options';
import type { SearchParams, NavigateWithSearch } from '@/types';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];

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
  ssr: 'data-only',
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getCustomerFilters(deps);
    await queryClient.ensureQueryData(customersQueryOptions(filters));
  },
  component: CustomersPage
});

function CustomersPage() {
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

  const { data } = useSuspenseQuery(customersQueryOptions(filters));
  const pageCount = Math.max(1, Math.ceil(data.total_customers / perPage));

  const { table } = useDataTable({
    data: data.customers,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
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
          placeholder={t('customer.searchPlaceholder')}
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
      <CustomerFormSheetTrigger />
    </div>
  );

  return (
    <PageContainer>
      <DataTableCard
        title={t('customer.titlePlural')}
        description={t('customer.pageDescription')}
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
                <span className='text-muted-foreground'>{t('customer.status')}:</span>
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
