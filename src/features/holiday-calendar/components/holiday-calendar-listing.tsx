import { useState } from 'react';
import {
  type ColumnFiltersState,
  type ColumnPinningState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table';
import { CalendarX2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { nationalHolidaysQueryOptions } from '../api/queries';
import { useImportHolidaysFromApi } from '../api/mutations';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { columns } from './holiday-columns';
import { HolidayFormDialog } from './holiday-form-dialog';
import { Icons } from '@/components/icons';

export function HolidayCalendarListing() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(nationalHolidaysQueryOptions());
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importMutation = useImportHolidaysFromApi();

  const handleImport = () => {
    importMutation.mutate(
      { year: new Date().getFullYear() },
      {
        onSuccess: (result) => {
          toast.success(t('holiday.importSuccess', { count: result.count }));
          setImportOpen(false);
        },
        onError: () => {
          toast.error(t('holiday.importFailed'));
        }
      }
    );
  };

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

  const hasSearchFilter = (table.getColumn('name')?.getFilterValue() as string) ?? '';

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;

  const showEmptyState = holidays.length === 0 && !hasSearchFilter;

  return (
    <div className='flex flex-col gap-4'>
      {showEmptyState ? (
        <Card className='mx-auto w-full max-w-2xl'>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <CalendarX2 className='mb-4 h-12 w-12 text-muted-foreground/50' />
            <h3 className='mb-1 text-lg font-semibold'>{t('holiday.emptyTitle')}</h3>
            <p className='mb-4 max-w-sm text-sm text-muted-foreground'>
              {t('holiday.emptyDescription')}
            </p>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setImportOpen(true)}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Icons.download className='mr-2 h-4 w-4' />
                )}
                {t('holiday.importHolidays')}
              </Button>
              <Button size='sm' onClick={() => setFormOpen(true)}>
                <Icons.add className='mr-2 h-4 w-4' />
                {t('holiday.addHoliday')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTableCard
          title={t('holiday.title')}
          description={t('holiday.description')}
          action={
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setImportOpen(true)}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Icons.download className='mr-2 h-4 w-4' />
                )}
                {t('holiday.importHolidays')}
              </Button>
              <Button size='sm' onClick={() => setFormOpen(true)}>
                <Icons.add className='mr-2 h-4 w-4' />
                {t('holiday.addHoliday')}
              </Button>
            </>
          }
        >
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
        </DataTableCard>
      )}

      <HolidayFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('holiday.importConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('holiday.importConfirmDescription', { year: new Date().getFullYear() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? t('holiday.importing') : t('holiday.importConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
