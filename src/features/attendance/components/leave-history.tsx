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
import { useTranslation } from 'react-i18next';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved: 'default',
  pending: 'secondary',
  rejected: 'destructive',
  cancelled: 'outline'
};

const statusFilters = [
  { value: '', labelKey: 'common.all' },
  { value: 'pending', labelKey: 'attendance.pending' },
  { value: 'approved', labelKey: 'attendance.approved' },
  { value: 'rejected', labelKey: 'attendance.rejected' }
] as const;

export default function LeaveHistory() {
  const { t } = useTranslation();
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
          {t('attendance.leaveHistory')}
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
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <div className='hidden gap-2 md:flex'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder={t('attendance.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('attendance.allStatus')}</SelectItem>
              <SelectItem value='pending'>{t('attendance.pending')}</SelectItem>
              <SelectItem value='approved'>{t('attendance.approved')}</SelectItem>
              <SelectItem value='rejected'>{t('attendance.rejected')}</SelectItem>
              <SelectItem value='cancelled'>{t('attendance.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : leaves.length === 0 ? (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            {t('attendance.noLeaveRequests')}
          </div>
        ) : (
          <>
            <div className='hidden md:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('attendance.type')}</TableHead>
                    <TableHead>{t('attendance.start')}</TableHead>
                    <TableHead>{t('attendance.end')}</TableHead>
                    <TableHead>{t('attendance.days')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('attendance.reason')}</TableHead>
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
                      {leave.leave_type} {t('attendance.leaveSuffix')}
                    </p>
                    <Badge
                      variant={statusColors[leave.status ?? 'cancelled'] ?? 'outline'}
                      className='h-5 rounded-full px-2 text-[10px]'
                    >
                      {leave.status}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground mt-1 text-[11px]'>
                    {leave.start_date} – {leave.end_date} ·{' '}
                    {t('attendance.dayCount', { count: leave.total_days })}
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
