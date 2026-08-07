import { useState } from 'react';
import {
  type ColumnFiltersState,
  type ColumnPinningState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table';
import { Search, AlertTriangle, ChevronRight, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { useQuery } from '@tanstack/react-query';
import { RoleGroupFormSheetTrigger } from './role-group-form-sheet';
import { useTranslation } from 'react-i18next';
import { roleGroupsQueryOptions } from '../api/queries';
import type { RoleGroup } from '../api/types';
import { roleGroupColumns } from './role-group-columns';

export default function RoleGroupListingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(roleGroupsQueryOptions());

  const groups = (data as { role_groups?: RoleGroup[] } | undefined)?.role_groups ?? [];

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: groups,
    columns: roleGroupColumns,
    defaultColumn: {
      size: 140,
      minSize: 80,
      maxSize: 420
    },
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      columnVisibility: { search: false },
      columnPinning: { right: ['actions'] } as ColumnPinningState,
      pagination: { pageSize: 12 }
    }
  });

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;

  return (
    <div className='flex h-full flex-col gap-4'>
      <Tabs className='flex min-h-0 flex-1 flex-col gap-4' defaultValue='roles'>
        <TabsList className='w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none'>
          <TabsTrigger value='roles'>Roles</TabsTrigger>
          <TabsTrigger value='permission-sets'>Permission sets</TabsTrigger>
          <TabsTrigger value='access-reviews'>Access reviews</TabsTrigger>
        </TabsList>

        <TabsContent value='roles' className='flex min-h-0 flex-1 flex-col gap-4'>
          <DataTableCard
            title='Roles & Permissions'
            description='Manage access roles and permissions across your organization.'
            action={
              <>
                <Button size='sm' variant='outline'>
                  <FileUp className='mr-2 h-4 w-4' />
                  Import JSON
                </Button>
                <RoleGroupFormSheetTrigger />
              </>
            }
          >
            <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50'>
              <AlertTriangle className='size-4' />
              <AlertTitle>Review required</AlertTitle>
              <AlertDescription className='flex items-center justify-between'>
                3 roles have unreviewed permission changes.
                <Button size='sm' variant='link' className='ml-2'>
                  Review changes
                  <ChevronRight className='ml-1 h-4 w-4' />
                </Button>
              </AlertDescription>
            </Alert>

            <DataTable table={table}>
              <div className='flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
                <div className='relative w-full rounded-md sm:w-80'>
                  <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    className='h-7 pl-9'
                    placeholder='Search roles...'
                    value={(table.getColumn('search')?.getFilterValue() as string) ?? ''}
                    onChange={(e) => {
                      table.getColumn('search')?.setFilterValue(e.target.value || undefined);
                    }}
                  />
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <Select
                    value={(table.getColumn('type')?.getFilterValue() as string) ?? 'All'}
                    onValueChange={(v) => {
                      table.getColumn('type')?.setFilterValue(v === 'All' ? undefined : v);
                    }}
                  >
                    <SelectTrigger size='sm'>
                      <span className='text-muted-foreground'>Type:</span>
                      <SelectValue placeholder='All' />
                    </SelectTrigger>
                    <SelectContent position='popper' align='start'>
                      <SelectGroup>
                        <SelectItem value='All'>All</SelectItem>
                        <SelectItem value='System'>System</SelectItem>
                        <SelectItem value='Custom'>Custom</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DataTable>
          </DataTableCard>
        </TabsContent>

        <TabsContent value='permission-sets'>
          <div className='flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm'>
            Permission Sets Coming Soon
          </div>
        </TabsContent>

        <TabsContent value='access-reviews'>
          <div className='flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm'>
            Access Reviews Coming Soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
