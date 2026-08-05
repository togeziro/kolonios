import type { ColumnDef } from '@tanstack/react-table';
import type { AuditLogListItem } from '../api/service';
import { format } from 'date-fns';

export const auditLogColumns: ColumnDef<AuditLogListItem>[] = [
  {
    id: 'time',
    accessorKey: 'createdAt',
    header: 'Time',
    size: 160,
    cell: ({ row }) => (
      <span className='whitespace-nowrap text-sm tabular-nums'>
        {format(new Date(row.original.createdAt), 'yyyy-MM-dd HH:mm')}
      </span>
    )
  },
  {
    id: 'actor',
    accessorKey: 'actorUserId',
    header: 'Actor',
    size: 120,
    cell: ({ row }) => <span className='text-sm'>{row.original.actorUserId}</span>
  },
  {
    id: 'action',
    accessorKey: 'action',
    header: 'Action',
    size: 200,
    cell: ({ row }) => <span className='font-mono text-xs'>{row.original.action}</span>
  },
  {
    id: 'entity',
    accessorKey: 'entityType',
    header: 'Entity',
    size: 120,
    cell: ({ row }) => <span className='text-sm capitalize'>{row.original.entityType}</span>
  },
  {
    id: 'entityId',
    accessorKey: 'entityId',
    header: 'ID',
    size: 100,
    cell: ({ row }) => <span className='font-mono text-xs'>{row.original.entityId ?? '—'}</span>
  }
];
