import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { useAppLocale } from '@/lib/locale';
import { myAttendanceQueryOptions } from '../api/queries';

export default function MobileAttendanceSummary() {
  const { t } = useTranslation();
  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const locale = useAppLocale();

  const attendance = todayData?.attendance;
  const record = attendance?.attendance;
  const isCheckedIn = !!record?.check_in_time;
  const isCheckedOut = !!record?.check_out_time;

  const shift = attendance?.shift;
  const location = attendance?.location;
  const shiftLine =
    shift != null
      ? `${t('attendance.shift')} ${shift.start_time} - ${shift.end_time}${
          location ? ` · ${location.name}` : ''
        }`
      : null;

  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }, locale);

  const title = isCheckedOut
    ? t('attendance.shiftComplete')
    : isCheckedIn
      ? t('attendance.onTheClock')
      : t('attendance.readyToStartShift');

  const statusText = isCheckedOut
    ? t('attendance.shiftComplete')
    : isCheckedIn
      ? t('attendance.checkedIn')
      : t('attendance.notCheckedIn');

  const detailLine = isCheckedOut
    ? t('attendance.checkedOutAt', { time: record!.check_out_time })
    : isCheckedIn
      ? t('attendance.checkedInAt', { time: record!.check_in_time })
      : shiftLine;

  return (
    <div className='px-4 py-3'>
      <div className='flex flex-col items-stretch justify-start rounded-2xl border shadow-sm dark:border-zinc-800/50 dark:bg-[#252527] p-5'>
        <div className='mb-4 flex items-start justify-between'>
          <div className='flex flex-col gap-1'>
            <p className='text-muted-foreground text-[11px] font-semibold tracking-wider uppercase dark:text-zinc-400'>
              {t('attendance.todayLabel')}, {today}
            </p>
            <h3 className='text-lg font-bold leading-tight dark:text-white'>{title}</h3>
          </div>
          <div className='bg-muted rounded-lg p-2 dark:bg-zinc-800'>
            <Icons.clock className='h-4 w-4 text-muted-foreground dark:text-zinc-400' />
          </div>
        </div>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            {detailLine && (
              <p className='text-sm font-medium text-muted-foreground dark:text-zinc-300'>
                {detailLine}
              </p>
            )}
            <div className='flex items-center gap-2'>
              <span
                className={`size-2 rounded-full ${
                  isCheckedIn ? 'bg-emerald-400' : 'bg-muted-foreground dark:bg-zinc-500'
                }`}
              />
              <p className='text-sm font-normal text-muted-foreground dark:text-zinc-400'>
                {statusText}
              </p>
            </div>
          </div>
          <Link
            to='/dashboard/attendance'
            className='flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-tight text-primary-foreground transition-transform active:scale-95 dark:bg-white dark:text-black'
          >
            {isCheckedOut
              ? t('attendance.viewSummary')
              : isCheckedIn
                ? t('attendance.checkOut')
                : t('attendance.checkIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
