import { useMemo, useState } from 'react';
import { appFeatures } from '@/lib/table-features';
import { type ColumnFiltersState, type ColumnPinningState, useTable } from '@tanstack/react-table';
import { Search, FileUp } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertModal } from '@/components/modal/alert-modal';
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
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableCard } from '@/components/ui/table/data-table-card';
import { useQuery } from '@tanstack/react-query';
import { RoleGroupFormSheet, RoleGroupFormSheetTrigger } from './role-group-form-sheet';
import { useTranslation } from 'react-i18next';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { deleteRoleGroupMutation } from '../api/mutations';
import { roleGroupsQueryOptions } from '../api/queries';
import type { RoleGroup } from '../api/types';
import { getRoleGroupColumns } from './role-group-columns';

export default function RoleGroupListingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(roleGroupsQueryOptions());
  const { isAdmin, permissions } = useRoleGroupPermissions();

  const canEdit = isAdmin || permissions.role_groups?.edit === true;
  const canDelete = isAdmin || permissions.role_groups?.delete === true;

  const [editingGroup, setEditingGroup] = useState<RoleGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<RoleGroup | null>(null);

  const deleteMutation = useMutation(
    mergeMutationCallbacks(deleteRoleGroupMutation, {
      onSuccess: () => {
        toast.success(t('roleGroups.deleted'));
        setDeletingGroup(null);
      },
      onError: () => toast.error(t('roleGroups.deleteFailed'))
    })
  );

  const groups = (data as { role_groups?: RoleGroup[] } | undefined)?.role_groups ?? [];

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo(
    () =>
      getRoleGroupColumns({
        t,
        canEdit,
        canDelete,
        onEdit: setEditingGroup,
        onDelete: setDeletingGroup
      }),
    [t, canEdit, canDelete]
  );

  const table = useTable({
    features: appFeatures,
    data: groups,
    columns,
    defaultColumn: {
      size: 140,
      minSize: 80,
      maxSize: 420
    },
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      columnVisibility: { search: false },
      columnPinning: { start: [], end: ['actions'] } as ColumnPinningState,
      pagination: { pageIndex: 0, pageSize: 12 }
    }
  });

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;

  return (
    <>
      <RoleGroupFormSheet
        group={editingGroup ?? undefined}
        open={editingGroup !== null}
        onOpenChange={(open) => {
          if (!open) setEditingGroup(null);
        }}
      />
      <AlertModal
        isOpen={deletingGroup !== null}
        onClose={() => setDeletingGroup(null)}
        onConfirm={() => {
          if (deletingGroup) deleteMutation.mutate(deletingGroup.id);
        }}
        loading={deleteMutation.isPending}
      />
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
    </>
  );
}
