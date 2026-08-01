import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { attendanceHistoryQueryOptions } from '../api/queries';
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

function formatDuration(inTime?: string | null, outTime?: string | null): string | null {
  if (!inTime || !outTime) return null;
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  const mins = oh * 60 + om - (ih * 60 + im);
  if (mins <= 0) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const historyStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  present: 'default',
  late: 'secondary',
  absent: 'destructive',
  excused: 'outline',
  pending: 'outline'
};

export default function AttendanceHistory() {
  const { t } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery(
    attendanceHistoryQueryOptions({ page: 1, limit: 31, month, year })
  );

  const records = data?.records ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Icons.calendar className='h-5 w-5' />
          {t('attendance.historyTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex gap-2'>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder={t('attendance.monthPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {new Date(2000, m - 1).toLocaleString('en', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className='w-24'>
              <SelectValue placeholder={t('attendance.yearPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 3 }, (_, i) => now.getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : records.length === 0 ? (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            {t('attendance.noRecords')}
          </div>
        ) : (
          <>
            <div className='hidden md:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('attendance.shift')}</TableHead>
                    <TableHead>{t('attendance.checkIn')}</TableHead>
                    <TableHead>{t('attendance.checkOut')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(({ attendance, shift }) => (
                    <TableRow key={attendance.id}>
                      <TableCell>{attendance.date}</TableCell>
                      <TableCell>{shift ? shift.name : '-'}</TableCell>
                      <TableCell>{attendance.check_in_time ?? '-'}</TableCell>
                      <TableCell>{attendance.check_out_time ?? '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            attendance.attendance_status === 'present'
                              ? 'default'
                              : attendance.attendance_status === 'late'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {attendance.attendance_status ?? 'pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className='space-y-2 md:hidden'>
              {records.map(({ attendance, shift }) => (
                <Card key={attendance.id} className='flex items-center gap-3 rounded-xl p-3.5'>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold'>{attendance.date}</p>
                    <p className='text-muted-foreground truncate text-[11px]'>
                      {shift ? shift.name : t('attendance.noShift')}
                      {' · '}
                      {formatDuration(attendance.check_in_time, attendance.check_out_time) ?? '—'}
                    </p>
                    <p className='text-muted-foreground text-[11px]'>
                      {attendance.check_in_time ?? '--:--'} – {attendance.check_out_time ?? '--:--'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      historyStatusVariant[attendance.attendance_status ?? 'pending'] ?? 'outline'
                    }
                    className='h-5 rounded-full px-2 text-[10px]'
                  >
                    {attendance.attendance_status ?? 'pending'}
                  </Badge>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
