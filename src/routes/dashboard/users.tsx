import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { Cog, Download, Search, SlidersHorizontal } from 'lucide-react';
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
import { usersQueryOptions } from '@/features/users/api/queries';
import { getUsersFn } from '@/features/users/api/service';
import { usersToCsv, downloadCsv } from '@/lib/export-csv';
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet';
import { columns } from '@/features/users/components/users-table/columns';
import { AUTH_ROLE_OPTIONS, STATUS_OPTIONS } from '@/features/users/components/users-table/options';
import type { SearchParams, NavigateWithSearch } from '@/types';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];
const statusOptions = STATUS_OPTIONS.filter((option) => option.value !== 'Invited');

const usersSearchSchema = z.object({
  page: z.number().optional().default(1),
  perPage: z.number().optional().default(10),
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional()
});

function getUsersFilters(search: SearchParams) {
  return parseFilters(search, {
    sortColumns: ['name', 'role', 'created_at', 'actions'],
    fieldMappings: { role: 'role' }
  });
}

export const Route = createFileRoute('/dashboard/users')({
  head: () => ({ meta: [{ title: 'Dashboard: Users' }] }),
  validateSearch: zodValidator(usersSearchSchema),
  ssr: 'data-only',
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    const filters = getUsersFilters(deps);
    await queryClient.ensureQueryData(usersQueryOptions(filters));
  },
  component: UsersPage
});

function UsersPage() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as SearchParams;
  const navigate = useNavigate() as unknown as NavigateWithSearch;

  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const name = search.name as string | undefined;
  const role = search.role as string | undefined;
  const status = search.status as string | undefined;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, columnIds);

  const filters = {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(role && { roles: role }),
    ...(status && { status }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };

  const { data } = useSuspenseQuery(usersQueryOptions(filters));
  const pageCount = Math.max(1, Math.ceil(data.total_users / perPage));

  const { table } = useDataTable({
    data: data.users,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500
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

  async function handleExport() {
    const all = await getUsersFn({ data: { ...filters, page: 1, limit: 100 } });
    const csv = usersToCsv(all.users);
    downloadCsv('users.csv', csv);
  }

  const toolbar = (
    <div className='flex flex-wrap items-center gap-2'>
      <InputGroup className='h-7 w-full md:w-64'>
        <InputGroupAddon align='inline-start'>
          <Search className='size-3.5' />
        </InputGroupAddon>
        <InputGroupInput
          className='h-7'
          placeholder={t('user.searchPlaceholder')}
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
            <Cog /> {t('table.customize')}
          </Button>
        }
      />
      <Button variant='outline' size='sm' onClick={handleExport}>
        <Download /> {t('table.export')}
      </Button>
      <UserFormSheetTrigger />
    </div>
  );

  return (
    <PageContainer>
      <DataTableCard
        title={t('user.titlePlural')}
        description={t('user.pageDescription')}
        action={toolbar}
      >
        <div className='flex flex-wrap items-center justify-between gap-3 px-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Select
              value={role ?? 'All'}
              onValueChange={(value) =>
                setColumnSelectFilter('role', value === 'All' ? null : value)
              }
            >
              <SelectTrigger size='sm'>
                <span className='text-muted-foreground'>{t('user.role')}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align='start'>
                <SelectGroup>
                  {AUTH_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={status ?? 'All'}
              onValueChange={(value) =>
                setColumnSelectFilter('status', value === 'All' ? null : value)
              }
            >
              <SelectTrigger size='sm'>
                <span className='text-muted-foreground'>{t('user.status')}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align='start'>
                <SelectGroup>
                  {statusOptions.map((option) => (
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
