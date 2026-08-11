import type { ColumnDef } from '@tanstack/react-table';
import { MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InitialChip } from '@/components/ui/initial-chip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Link } from '@tanstack/react-router';
import { formatDate } from '@/lib/format';
import type { RoleGroup } from '../api/types';

export const roleGroupColumns: ColumnDef<RoleGroup>[] = [
  {
    id: 'search',
    accessorFn: (row) => [row.name, row.description].join(' '),
    filterFn: 'includesString',
    enableHiding: true
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Role Group',
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
    header: 'Description',
    size: 300,
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>{row.original.description || '-'}</span>
    )
  },
  {
    id: 'type',
    accessorKey: 'is_admin',
    header: 'Type',
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
        {row.original.is_admin ? 'System' : 'Custom'}
      </Badge>
    )
  },
  {
    id: 'permissions',
    accessorFn: (row) => Object.keys(row.permissions || {}).length,
    header: 'Permissions',
    size: 100,
    cell: ({ row }) => (
      <span className='text-sm'>{Object.keys(row.original.permissions || {}).length} modules</span>
    )
  },
  {
    id: 'created_at',
    accessorKey: 'created_at',
    header: 'Created',
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
    cell: ({ row }) => {
      const isSystemRole = row.original.is_admin;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon'>
              <MoreVertical className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-48' align='end'>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to='/dashboard/admin/role-groups/$id' params={{ id: row.original.id }}>
                  View details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isSystemRole}>Edit role</DropdownMenuItem>
              <DropdownMenuItem disabled={isSystemRole}>Duplicate role</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>Review permissions</DropdownMenuItem>
              <DropdownMenuItem>Manage members</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={isSystemRole} variant='destructive'>
                Delete role
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableColumnFilter: false
  }
];
