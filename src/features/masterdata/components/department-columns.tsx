import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { InitialChip } from '@/components/ui/initial-chip';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';

export interface DepartmentRow {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean | null;
}

export function getDepartmentColumns(
  onEdit: (row: DepartmentRow) => void,
  onDelete: (row: DepartmentRow) => void,
  t: (key: string) => string
): ColumnDef<AppFeatures, DepartmentRow>[] {
  return [
    {
      id: 'code',
      accessorKey: 'code',
      header: ({ column }: { column: Column<AppFeatures, DepartmentRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.code')} />
      ),
      cell: ({ cell }) => <div className='font-mono text-xs'>{cell.getValue<string>()}</div>
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }: { column: Column<AppFeatures, DepartmentRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.name')} />
      ),
      cell: ({ row }) => (
        <div className='flex items-center gap-3'>
          <InitialChip name={row.original.name} size='sm' />
          <span className='font-medium'>{row.original.name}</span>
        </div>
      )
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: ({ column }: { column: Column<AppFeatures, DepartmentRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('masterdata.description')} />
      ),
      cell: ({ cell }) => (
        <span className='text-muted-foreground'>{cell.getValue<string | null>() || '-'}</span>
      )
    },
    {
      id: 'is_active',
      accessorKey: 'is_active',
      header: ({ column }: { column: Column<AppFeatures, DepartmentRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.status')} />
      ),
      cell: ({ cell }) => {
        const active = cell.getValue<boolean | null>();
        return (
          <StatusBadge
            status={active ? 'active' : 'inactive'}
            label={active ? t('common.active') : t('common.inactive')}
          />
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className='text-center'>{t('table.actions')}</div>,
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className='flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none'>
            <span className='sr-only'>Open menu</span>
            <Icons.ellipsis className='h-4 w-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Icons.edit className='mr-2 h-4 w-4' /> {t('common.update')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(row.original)}>
              <Icons.trash className='mr-2 h-4 w-4' /> {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];
}
