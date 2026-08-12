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
          <TabsTrigger value='roles'>{t('roleGroups.rolesTab')}</TabsTrigger>
          <TabsTrigger value='permission-sets'>{t('roleGroups.permissionSetsTab')}</TabsTrigger>
          <TabsTrigger value='access-reviews'>{t('roleGroups.accessReviewsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value='roles' className='flex min-h-0 flex-1 flex-col gap-4'>
          <DataTableCard
            title={t('roleGroups.rolesTitle')}
            description={t('roleGroups.rolesDescription')}
            action={
              <>
                <Button size='sm' variant='outline'>
                  <FileUp />
                  {t('common.importJson')}
                </Button>
                <RoleGroupFormSheetTrigger />
              </>
            }
          >
            <Alert className='border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50'>
              <AlertTriangle className='size-4' />
              <AlertTitle>{t('roleGroups.reviewRequired')}</AlertTitle>
              <AlertDescription className='flex items-center justify-between'>
                {t('roleGroups.reviewPending')}
                <Button size='sm' variant='link' className='ml-2'>
                  {t('roleGroups.reviewChanges')}
                  <ChevronRight className='ml-1 h-4 w-4' />
                </Button>
              </AlertDescription>
            </Alert>

            <DataTable table={table}>
              <div className='flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
                <div className='relative w-full rounded-md sm:w-80'>
                  <Search className='absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    className='h-7 pl-9'
                    placeholder={t('roleGroups.searchPlaceholder')}
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
                      <span className='text-muted-foreground'>{t('roleGroups.typeFilter')}</span>
                      <SelectValue placeholder={t('common.all')} />
                    </SelectTrigger>
                    <SelectContent position='popper' align='start'>
                      <SelectGroup>
                        <SelectItem value='All'>{t('common.all')}</SelectItem>
                        <SelectItem value='System'>{t('common.system')}</SelectItem>
                        <SelectItem value='Custom'>{t('common.custom')}</SelectItem>
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
            {t('roleGroups.permissionSetsComingSoon')}
          </div>
        </TabsContent>

        <TabsContent value='access-reviews'>
          <div className='flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm'>
            {t('roleGroups.accessReviewsComingSoon')}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
