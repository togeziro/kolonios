import { useState } from 'react';
import {
  type ColumnFiltersState,
  type ColumnPinningState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/table/data-table';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { nationalHolidaysQueryOptions } from '../api/queries';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { columns } from './holiday-columns';
import { HolidayFormDialog } from './holiday-form-dialog';
import { Icons } from '@/components/icons';

export function HolidayCalendarListing() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(nationalHolidaysQueryOptions());
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [formOpen, setFormOpen] = useState(false);

  const holidays = (data as { holidays?: NationalHoliday[] } | undefined)?.holidays ?? [];

  const table = useReactTable({
    data: holidays,
    columns,
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
      columnPinning: { right: ['actions'] } as ColumnPinningState,
      pagination: { pageSize: 12 }
    }
  });

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col items-start gap-4 sm:flex-row sm:justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-3xl tracking-tight'>{t('holiday.title')}</h1>
          <p className='text-muted-foreground text-sm'>{t('holiday.description')}</p>
        </div>
        <Button size='sm' onClick={() => setFormOpen(true)}>
          <Icons.add className='mr-2 h-4 w-4' />
          {t('holiday.addHoliday')}
        </Button>
      </div>

      <DataTable table={table}>
        <div className='flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
          <div className='relative w-full rounded-md sm:w-80'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              className='h-7 pl-9'
              placeholder={t('holiday.searchPlaceholder')}
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(e) => {
                table.getColumn('name')?.setFilterValue(e.target.value || undefined);
              }}
            />
          </div>
        </div>
      </DataTable>

      <HolidayFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
