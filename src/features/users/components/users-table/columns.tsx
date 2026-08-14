import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { InitialChip } from '@/components/ui/initial-chip';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';
import { Icons } from '@/components/icons';
import { CellAction } from './cell-action';
import { AUTH_ROLE_OPTIONS } from './options';
import { getColorForName } from '@/lib/avatar-color';

export const columns: ColumnDef<AppFeatures, User>[] = [
  {
    id: 'select',
    size: 40,
    minSize: 40,
    maxSize: 40,
    header: ({ table }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          aria-label='Select all users'
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      </div>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    meta: { label: 'Select' }
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<AppFeatures, User, unknown> }) => (
      <DataTableColumnHeader column={column} title='common.name' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-3'>
        <InitialChip name={row.original.name} />
        <div className='flex flex-col'>
          <span className='font-medium'>{row.original.name}</span>
          <span className='text-muted-foreground text-xs'>{row.original.email}</span>
        </div>
      </div>
    ),
    meta: {
      label: 'Name',
      placeholder: 'Search users...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'role',
    accessorKey: 'role',
    enableSorting: false,
    header: ({ column }: { column: Column<AppFeatures, User, unknown> }) => (
      <DataTableColumnHeader column={column} title='user.role' />
    ),
    cell: ({ row }) => {
      const role = row.original.role_group_name || row.original.role;
      const color = getColorForName(role);
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color.bg} ${color.fg} ${color.darkBg} ${color.darkFg}`}
        >
          {role}
        </span>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'roles',
      variant: 'multiSelect' as const,
      options: AUTH_ROLE_OPTIONS
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }: { column: Column<AppFeatures, User, unknown> }) => (
      <DataTableColumnHeader column={column} title='user.status' />
    ),
    cell: ({ cell }) => {
      const status = cell.getValue<User['status']>();
      return <StatusBadge status={status} />;
    }
  },
  {
    id: 'created_at',
    accessorFn: (row) => new Date(row.created_at).getTime(),
    header: ({ column }: { column: Column<AppFeatures, User, unknown> }) => (
      <DataTableColumnHeader column={column} title='user.joinedDate' />
    ),
    cell: ({ row }) => (
      <div className='text-foreground text-sm'>
        {format(new Date(row.original.created_at), 'dd MMM yyyy')}
      </div>
    ),
    enableColumnFilter: false,
    meta: { label: 'Joined date' }
  },
  {
    id: 'actions',
    size: 48,
    minSize: 48,
    maxSize: 48,
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
