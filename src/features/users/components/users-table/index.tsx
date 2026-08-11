import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { Cog, Download, Search, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
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
import { ColumnVisibilityMenu } from '@/components/ui/table/data-table-view-options';
import { useDataTable } from '@/hooks/use-data-table';
import { parseSortingState } from '@/lib/parsers';
import { usersQueryOptions } from '../../api/queries';
import { getUsersFn } from '../../api/service';
import { usersToCsv, downloadCsv } from '@/lib/export-csv';
import { UserFormSheetTrigger } from '../user-form-sheet';
import { columns } from './columns';
import type { SearchParams, NavigateWithSearch } from '@/types';
import { AUTH_ROLE_OPTIONS, STATUS_OPTIONS } from './options';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];

const statusOptions = STATUS_OPTIONS.filter((option) => option.value !== 'Invited');

export function UsersTable() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as SearchParams;

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
    debounceMs: 500,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  });

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const navigate = useNavigate() as unknown as NavigateWithSearch;

  function setColumnSelectFilter(columnId: string, value: string | null) {
    void navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, [columnId]: value ?? undefined }),
      replace: true
    });
  }

  async function handleExport() {
    const all = await getUsersFn({ data: { ...filters, page: 1, limit: 100 } });
    const csv = usersToCsv(all.users);
    downloadCsv('users.csv', csv);
  }

  return (
    <>
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

      <div className='flex flex-wrap items-center justify-between gap-3 px-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Select
            value={role ?? 'All'}
            onValueChange={(value) => setColumnSelectFilter('role', value === 'All' ? null : value)}
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

        <div className='text-muted-foreground text-sm tabular-nums'>
          {t('table.selectedCount', { count: selectedCount })}
        </div>
      </div>

      <DataTable table={table} />
    </>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4'>
      <div className='bg-muted h-10 w-full rounded' />
      <div className='bg-muted h-96 w-full rounded-lg' />
      <div className='bg-muted h-10 w-full rounded' />
    </div>
  );
}
