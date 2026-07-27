import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Employee } from '../../api/types';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CellAction } from './cell-action';
import { STATUS_OPTIONS } from './options';

export const columns: ColumnDef<Employee>[] = [
  {
    id: 'employee_code',
    accessorKey: 'employee_code',
    header: ({ column }: { column: Column<Employee, unknown> }) => (
      <DataTableColumnHeader column={column} title='Code' />
    ),
    cell: ({ cell }) => (
      <div className='font-medium'>{cell.getValue<Employee['employee_code']>()}</div>
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
    header: ({ column }: { column: Column<Employee, unknown> }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.original.full_name}</span>
        <span className='text-muted-foreground text-xs'>{row.original.email}</span>
      </div>
    ),
    meta: {
      label: 'Name',
      placeholder: 'Search employees...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'department_name',
    accessorKey: 'department_name',
    header: ({ column }: { column: Column<Employee, unknown> }) => (
      <DataTableColumnHeader column={column} title='Department' />
    ),
    cell: ({ cell }) => <div>{cell.getValue<Employee['department_name']>()}</div>
  },
  {
    id: 'designation_name',
    accessorKey: 'designation_name',
    header: ({ column }: { column: Column<Employee, unknown> }) => (
      <DataTableColumnHeader column={column} title='Designation' />
    ),
    cell: ({ cell }) => <div>{cell.getValue<Employee['designation_name']>()}</div>
  },
  {
    accessorKey: 'phone',
    header: 'PHONE',
    cell: ({ cell }) => <div>{cell.getValue<Employee['phone']>()}</div>
  },
  {
    id: 'status',
    accessorKey: 'status',
    enableSorting: false,
    header: ({ column }: { column: Column<Employee, unknown> }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ cell }) => {
      const status = cell.getValue<Employee['status']>();
      const variant = status === 'active' ? 'default' : 'secondary';
      return <Badge variant={variant}>{status}</Badge>;
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
    header: 'CREATED AT',
    cell: ({ cell }) => {
      const date = cell.getValue<Employee['created_at']>();
      return <div>{new Date(date).toLocaleDateString()}</div>;
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
