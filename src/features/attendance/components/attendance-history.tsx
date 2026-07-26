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

export default function AttendanceHistory() {
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
          Attendance History
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex gap-2'>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder='Month' />
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
              <SelectValue placeholder='Year' />
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
            No attendance records found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
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
        )}
      </CardContent>
    </Card>
  );
}
