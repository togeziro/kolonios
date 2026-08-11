import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { InitialChip } from '@/components/ui/initial-chip';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Customer } from '../../api/types';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { CellAction } from './cell-action';
import { STATUS_OPTIONS } from './options';

export const columns: ColumnDef<Customer>[] = [
  {
    id: 'customer_code',
    accessorKey: 'customer_code',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='customer.code' />
    ),
    cell: ({ cell }) => (
      <div className='font-medium'>{cell.getValue<Customer['customer_code']>()}</div>
    ),
    meta: {
      label: 'Code',
      placeholder: 'Search by code...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'full_name',
    accessorKey: 'full_name',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='customer.name' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-3'>
        <InitialChip name={row.original.full_name} />
        <div className='flex flex-col'>
          <span className='font-medium'>{row.original.full_name}</span>
          <span className='text-muted-foreground text-xs'>{row.original.email}</span>
        </div>
      </div>
    ),
    meta: {
      label: 'Name',
      placeholder: 'Search customers...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    accessorKey: 'email',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='customer.email' />
    ),
    cell: ({ cell }) => <div>{cell.getValue<Customer['email']>()}</div>
  },
  {
    accessorKey: 'phone',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='customer.phone' />
    ),
    cell: ({ cell }) => <div>{cell.getValue<Customer['phone']>()}</div>
  },
  {
    id: 'status',
    accessorKey: 'status',
    enableSorting: false,
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='customer.status' />
    ),
    cell: ({ cell }) => {
      const status = cell.getValue<Customer['status']>();
      return <StatusBadge status={status} />;
    },
    enableColumnFilter: true,
    meta: {
      label: 'status',
      variant: 'multiSelect' as const,
      options: STATUS_OPTIONS
    }
  },
  {
    accessorKey: 'created_at',
    header: ({ column }: { column: Column<Customer, unknown> }) => (
      <DataTableColumnHeader column={column} title='table.createdAt' />
    ),
    cell: ({ cell }) => {
      const date = cell.getValue<Customer['created_at']>();
      return <div>{formatDate(new Date(date))}</div>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
