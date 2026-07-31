import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { myLeavesQueryOptions } from '../api/queries';
import type { LeaveStatus } from '../api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  cancelled: 'outline'
};

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
] as const;

export default function LeaveHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const filterStatus: LeaveStatus | undefined =
    statusFilter && statusFilter !== 'all' ? (statusFilter as LeaveStatus) : undefined;

  const { data, isLoading } = useQuery(
    myLeavesQueryOptions({
      page: 1,
      limit: 20,
      status: filterStatus
    })
  );

  const leaves = data?.leaves ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Icons.calendar className='h-5 w-5' />
          Leave History
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex gap-2 md:hidden'>
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`h-9 rounded-full px-3 text-xs font-medium ${
                (statusFilter || '') === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className='hidden gap-2 md:flex'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='All Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='approved'>Approved</SelectItem>
              <SelectItem value='rejected'>Rejected</SelectItem>
              <SelectItem value='cancelled'>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : leaves.length === 0 ? (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            No leave requests found
          </div>
        ) : (
          <>
            <div className='hidden md:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className='capitalize'>{leave.leave_type}</TableCell>
                      <TableCell>{leave.start_date}</TableCell>
                      <TableCell>{leave.end_date}</TableCell>
                      <TableCell>{leave.total_days}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[leave.status ?? 'cancelled'] ?? 'outline'}>
                          {leave.status}
                        </Badge>
                      </TableCell>
                      <TableCell className='max-w-40 truncate'>{leave.reason ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className='space-y-2 md:hidden'>
              {leaves.map((leave) => (
                <Card key={leave.id} className='rounded-xl p-3.5'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='min-w-0 flex-1 truncate text-sm font-semibold capitalize'>
                      {leave.leave_type} leave
                    </p>
                    <Badge
                      variant={statusColors[leave.status ?? 'cancelled'] ?? 'outline'}
                      className='h-5 rounded-full px-2 text-[10px]'
                    >
                      {leave.status}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground mt-1 text-[11px]'>
                    {leave.start_date} – {leave.end_date} · {leave.total_days} day
                    {leave.total_days !== 1 ? 's' : ''}
                  </p>
                  {leave.reason && (
                    <p className='text-muted-foreground mt-0.5 truncate text-[11px]'>
                      {leave.reason}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
