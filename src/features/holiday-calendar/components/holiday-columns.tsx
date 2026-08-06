import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CellAction } from './holiday-cell-action';

export const columns: ColumnDef<NationalHoliday>[] = [
  {
    id: 'date',
    accessorKey: 'date',
    header: ({ column }: { column: Column<NationalHoliday, unknown> }) => (
      <DataTableColumnHeader column={column} title='holiday.date' />
    ),
    cell: ({ cell }) => {
      const dateStr = cell.getValue<NationalHoliday['date']>();
      const date = new Date(dateStr + 'T00:00:00');
      return <div className='font-medium tabular-nums'>{date.toLocaleDateString()}</div>;
    },
    meta: {
      label: 'Date',
      placeholder: 'Search by date...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<NationalHoliday, unknown> }) => (
      <DataTableColumnHeader column={column} title='holiday.name' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.original.name}</span>
        {row.original.description && (
          <span className='text-muted-foreground text-xs line-clamp-1'>
            {row.original.description}
          </span>
        )}
      </div>
    ),
    meta: {
      label: 'Name',
      placeholder: 'Search holidays...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'is_recurring',
    accessorKey: 'is_recurring',
    enableSorting: false,
    header: ({ column }: { column: Column<NationalHoliday, unknown> }) => (
      <DataTableColumnHeader column={column} title='holiday.recurring' />
    ),
    cell: ({ cell }) => {
      const isRecurring = cell.getValue<NationalHoliday['is_recurring']>();
      return isRecurring ? (
        <Badge variant='secondary'>Recurring</Badge>
      ) : (
        <span className='text-muted-foreground text-sm'>—</span>
      );
    }
  },
  {
    id: 'source',
    accessorKey: 'source',
    enableSorting: false,
    header: ({ column }: { column: Column<NationalHoliday, unknown> }) => (
      <DataTableColumnHeader column={column} title='holiday.source' />
    ),
    cell: ({ cell }) => {
      const source = cell.getValue<NationalHoliday['source']>();
      return (
        <Badge variant={source === 'imported' ? 'default' : 'outline'}>
          {source === 'imported' ? 'Imported' : 'Manual'}
        </Badge>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
