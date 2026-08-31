import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ColumnFiltersState, type ColumnPinningState, useTable } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { Input } from '@/components/ui/input';
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
import { appFeatures } from '@/lib/table-features';
import { listShiftsQueryOptions } from '../api/queries';
import { deleteShiftMutation } from '../api/mutations';
import { buildShiftColumns, type ShiftListRow } from './shift-columns';
import { ShiftDeleteConfirmDialog } from './shift-delete-confirm-dialog';
import { ShiftFormSheet } from './shift-form-sheet';

type DeleteShiftResult = { success: boolean; mode?: 'soft' | 'hard' };

export function ShiftListing() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(listShiftsQueryOptions());

  const shifts = useMemo<ShiftListRow[]>(
    () =>
      (data as { success?: boolean; shifts?: ShiftListRow[] } | undefined)?.success
        ? ((data as { shifts: ShiftListRow[] }).shifts as ShiftListRow[])
        : [],
    [data]
  );

  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShiftListRow | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const deleteMutation = useMutation(
    mergeMutationCallbacks(deleteShiftMutation, {
      onSuccess: (result) => {
        const r = result as DeleteShiftResult;
        toast.success(
          r.mode === 'hard'
            ? t('attendanceAdmin.shiftHardDeleted')
            : t('attendanceAdmin.shiftDeactivated')
        );
      },
      onError: () => toast.error(t('attendanceAdmin.shiftDeleteFailed'))
    })
  );

  const onDelete = (id: number) => {
    const target = shifts.find((shift) => shift.id === id);
    if (!target) return;
    setDeleteTarget(target);
  };

  const onConfirmDelete = () => {
    if (!deleteTarget || deleteMutation.isPending) return;
    deleteMutation.mutate({ id: deleteTarget.id });
    setDeleteTarget(null);
  };

  const columns = useMemo(
    () =>
      buildShiftColumns({
        onEdit: (id) => setEditingShiftId(id),
        onDelete
      }),
    [onDelete]
  );

  const table = useTable({
    features: appFeatures,
    data: shifts,
    columns,
    defaultColumn: { size: 140, minSize: 80, maxSize: 420 },
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      columnVisibility: { search: false },
      columnPinning: { start: [], end: ['actions'] } as ColumnPinningState,
      pagination: { pageIndex: 0, pageSize: 12 }
    }
  });

  if (isLoading) {
    return (
      <div className='py-8 text-center text-muted-foreground text-sm'>{t('common.loading')}</div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-4'>
      <DataTableCard
        title={t('attendanceAdmin.shiftsTitle')}
        description={t('attendanceAdmin.shiftsDescription')}
        action={
          <button
            type='button'
            onClick={() => setAddOpen(true)}
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 items-center gap-1 rounded-md px-3 text-sm font-medium'
          >
            +{t('attendanceAdmin.addShift')}
          </button>
        }
      >
        <DataTable table={table}>
          <div className='flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
            <div className='relative w-full rounded-md sm:w-80'>
              <Search className='absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                className='h-7 pl-9'
                placeholder={t('attendanceAdmin.shiftsSearchPlaceholder')}
                value={(table.getColumn('search')?.getFilterValue() as string) ?? ''}
                onChange={(e) =>
                  table.getColumn('search')?.setFilterValue(e.target.value || undefined)
                }
              />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Select
                value={(table.getColumn('status')?.getFilterValue() as string) ?? 'All'}
                onValueChange={(v) => {
                  table.getColumn('status')?.setFilterValue(v === 'All' ? undefined : v);
                }}
              >
                <SelectTrigger size='sm'>
                  <span className='text-muted-foreground'>
                    {t('attendanceAdmin.shiftsStatusAll')}
                  </span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position='popper' align='start'>
                  <SelectGroup>
                    <SelectItem value='All'>{t('attendanceAdmin.shiftsStatusAll')}</SelectItem>
                    <SelectItem value='Active'>
                      {t('attendanceAdmin.shiftsStatusActive')}
                    </SelectItem>
                    <SelectItem value='Inactive'>
                      {t('attendanceAdmin.shiftsStatusInactive')}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DataTable>
      </DataTableCard>

      <ShiftFormSheet open={addOpen} onOpenChange={setAddOpen} />
      {editingShiftId != null && (
        <ShiftFormSheet
          shiftId={editingShiftId}
          open={editingShiftId != null}
          onOpenChange={(open) => !open && setEditingShiftId(null)}
        />
      )}
      {deleteTarget && (
        <ShiftDeleteConfirmDialog
          shift={deleteTarget}
          open={true}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          loading={deleteMutation.isPending}
          onConfirm={onConfirmDelete}
        />
      )}
    </div>
  );
}
