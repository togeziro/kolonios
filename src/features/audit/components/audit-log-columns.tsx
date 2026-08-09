import type { ColumnDef } from '@tanstack/react-table';
import type { AuditLogListItem } from '../api/service';
import { formatDate } from '@/lib/format';

export const auditLogColumns: ColumnDef<AuditLogListItem>[] = [
  {
    id: 'time',
    accessorKey: 'createdAt',
    header: 'Time',
    size: 160,
    cell: ({ row }) => (
      <span className='whitespace-nowrap text-sm tabular-nums'>
        {formatDate(new Date(row.original.createdAt), {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
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
