import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import {
  myAttendanceQueryOptions,
  locationsQueryOptions,
  shiftsQueryOptions
} from '../api/queries';
import { checkInFn, checkOutFn } from '../api/service';

export default function AttendanceCheckCard() {
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);

  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const { data: shiftsData } = useQuery(shiftsQueryOptions());

  const attendance = todayData?.attendance;
  const isCheckedIn = attendance && attendance.attendance?.check_in_time;
  const isCheckedOut = attendance && attendance.attendance?.check_out_time;
  const status = attendance?.attendance?.attendance_status;

  const checkInMutation = useMutation({
    mutationFn: () =>
      checkInFn({
        data: {
          locationId: selectedLocation ?? undefined,
          shiftId: selectedShift ?? undefined
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: () =>
      checkOutFn({
        data: { attendanceId: attendance!.attendance!.id }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });

  const locations = locationsData?.locations ?? [];
  const shifts = shiftsData?.shifts ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Icons.clock className='h-5 w-5' />
          Today&apos;s Attendance
        </CardTitle>
        <CardDescription>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {status && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Status:</span>
            <Badge
              variant={
                status === 'present' ? 'default' : status === 'late' ? 'secondary' : 'outline'
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        )}

        {isCheckedIn && (
          <div className='text-sm text-muted-foreground'>
            Check-in: {attendance!.attendance!.check_in_time}
          </div>
        )}

        {isCheckedOut && (
          <div className='text-sm text-muted-foreground'>
            Check-out: {attendance!.attendance!.check_out_time}
          </div>
        )}

        {!isCheckedIn && (
          <div className='space-y-3'>
            {locations.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {locations.map((loc) => (
                  <Button
                    key={loc.id}
                    variant={selectedLocation === loc.id ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setSelectedLocation(loc.id)}
                  >
                    <Icons.globe className='mr-1 h-4 w-4' />
                    {loc.name}
                  </Button>
                ))}
              </div>
            )}
            {shifts.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {shifts.map((s) => (
                  <Button
                    key={s.id}
                    variant={selectedShift === s.id ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setSelectedShift(s.id)}
                  >
                    <Icons.clock className='mr-1 h-4 w-4' />
                    {s.name} ({s.start_time} - {s.end_time})
                  </Button>
                ))}
              </div>
            )}
            <Button
              className='w-full'
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.login className='mr-2 h-4 w-4' />
              )}
              Check In
            </Button>
          </div>
        )}

        {isCheckedIn && !isCheckedOut && (
          <Button
            className='w-full'
            variant='secondary'
            onClick={() => checkOutMutation.mutate()}
            disabled={checkOutMutation.isPending}
          >
            {checkOutMutation.isPending ? (
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Icons.logout className='mr-2 h-4 w-4' />
            )}
            Check Out
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
