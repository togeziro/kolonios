import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { useAppLocale } from '@/lib/locale';
import { myAttendanceQueryOptions } from '../api/queries';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  present: 'default',
  late: 'secondary',
  absent: 'destructive',
  excused: 'outline',
  pending: 'outline'
};

export default function MobileAttendanceSummary() {
  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const locale = useAppLocale();

  const attendance = todayData?.attendance;
  const record = attendance?.attendance;
  const isCheckedIn = !!record?.check_in_time;
  const isCheckedOut = !!record?.check_out_time;
  const status = record?.attendance_status ?? 'pending';

  const today = formatDate(
    new Date(),
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    locale
  );

  return (
    <div className='px-4'>
      <Link to='/dashboard/attendance' className='block'>
        <Card className='flex items-center gap-3 rounded-2xl p-4'>
          <div className='bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'>
            <Icons.clock className='text-primary h-5 w-5' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-muted-foreground text-[11px]'>{today}</p>
            <p className='truncate text-sm font-semibold'>
              {isCheckedOut
                ? `Checked out at ${record!.check_out_time}`
                : isCheckedIn
                  ? `Checked in at ${record!.check_in_time}`
                  : 'Not yet checked in'}
            </p>
          </div>
          <Badge
            variant={statusVariant[status] ?? 'outline'}
            className='h-5 rounded-full px-2 text-[10px]'
          >
            {status}
          </Badge>
          <Icons.chevronRight className='text-muted-foreground h-4 w-4 shrink-0' />
        </Card>
      </Link>
    </div>
  );
}
