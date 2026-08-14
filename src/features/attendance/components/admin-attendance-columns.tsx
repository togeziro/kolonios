import type { ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';
import type { AdminAttendanceReportRow } from '@/lib/db/attendance';
import { Badge } from '@/components/ui/badge';

export const adminAttendanceColumns: ColumnDef<AppFeatures, AdminAttendanceReportRow>[] = [
  {
    id: 'date',
    accessorKey: 'attendance.date',
    header: 'Date',
    size: 120,
    cell: ({ row }) => <span className='text-sm'>{row.original.attendance.date}</span>
  },
  {
    id: 'employee',
    accessorFn: (row) => row.employee?.full_name ?? row.attendance.user_id,
    header: 'Employee',
    size: 180,
    cell: ({ row }) => (
      <span className='font-medium text-sm'>
        {row.original.employee?.full_name ?? row.original.attendance.user_id}
      </span>
    )
  },
  {
    id: 'department',
    accessorFn: (row) => row.department?.name ?? '-',
    header: 'Department',
    size: 150,
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>{row.original.department?.name ?? '-'}</span>
    )
  },
  {
    id: 'shift',
    accessorFn: (row) => row.shift?.name ?? '-',
    header: 'Shift',
    size: 120,
    cell: ({ row }) => <span className='text-sm'>{row.original.shift?.name ?? '-'}</span>
  },
  {
    id: 'checkIn',
    accessorKey: 'attendance.check_in_time',
    header: 'Check In',
    size: 120,
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>{row.original.attendance.check_in_time ?? '-'}</span>
    )
  },
  {
    id: 'checkOut',
    accessorKey: 'attendance.check_out_time',
    header: 'Check Out',
    size: 120,
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>{row.original.attendance.check_out_time ?? '-'}</span>
    )
  },
  {
    id: 'status',
    accessorKey: 'attendance.attendance_status',
    header: 'Status',
    size: 100,
    cell: ({ row }) => {
      const status = row.original.attendance.attendance_status;
      const variant =
        status === 'present'
          ? 'default'
          : status === 'late'
            ? 'secondary'
            : status === 'absent'
              ? 'destructive'
              : 'outline';

      return (
        <Badge variant={variant} className='capitalize'>
          {status}
        </Badge>
      );
    }
  }
];
