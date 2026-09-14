import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import type { AppFeatures } from '@/lib/table-features';
import { Badge } from '@/components/ui/badge';
import { InitialChip } from '@/components/ui/initial-chip';
import { Link } from '@tanstack/react-router';
import { formatDate } from '@/lib/format';
import type { RoleGroup } from '../api/types';
import { RoleGroupRowActions } from './role-group-row-actions';

export interface RoleGroupColumnOptions {
  t: TFunction;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (group: RoleGroup) => void;
  onDelete: (group: RoleGroup) => void;
}

export function getRoleGroupColumns({
  t,
  canEdit,
  canDelete,
  onEdit,
  onDelete
}: RoleGroupColumnOptions): ColumnDef<AppFeatures, RoleGroup>[] {
  return [
    {
      id: 'search',
      accessorFn: (row) => [row.name, row.description].join(' '),
      filterFn: 'includesString',
      enableHiding: true
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: t('roleGroups.colRole'),
      size: 200,
      minSize: 180,
      cell: ({ row }) => (
        <div className='flex items-center gap-3 text-sm'>
          <InitialChip name={row.original.name} size='sm' />
          <Link
            to='/dashboard/admin/role-groups/$id'
            params={{ id: row.original.id }}
            className='font-medium hover:underline'
          >
            {row.original.name}
          </Link>
        </div>
      )
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: t('roleGroups.colDescription'),
      size: 300,
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground'>{row.original.description || '-'}</span>
      )
    },
    {
      id: 'type',
      accessorKey: 'is_admin',
      header: t('roleGroups.colType'),
      size: 120,
      filterFn: (row, _columnId, filterValue) => {
        if (filterValue === 'All') return true;
        if (filterValue === 'System' && row.original.is_admin) return true;
        if (filterValue === 'Custom' && !row.original.is_admin) return true;
        return false;
      },
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_admin ? 'default' : 'outline'}
          className={
            row.original.is_admin
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
          }
        >
          {row.original.is_admin ? t('common.system') : t('common.custom')}
        </Badge>
      )
    },
    {
      id: 'permissions',
      accessorFn: (row) => Object.keys(row.permissions || {}).length,
      header: t('roleGroups.colPermissions'),
      size: 100,
      cell: ({ row }) => (
        <span className='text-sm'>
          {t('roleGroups.modulesCount', {
            count: Object.keys(row.original.permissions || {}).length
          })}
        </span>
      )
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: t('roleGroups.colCreated'),
      size: 120,
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground'>
          {formatDate(new Date(row.original.created_at))}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      size: 70,
      cell: ({ row }) => (
        <RoleGroupRowActions
          group={row.original}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
      enableColumnFilter: false
    }
  ];
}
