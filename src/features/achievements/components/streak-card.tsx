import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function StreakCard({
  current,
  best,
  weekDays
}: {
  current: number;
  best: number;
  weekDays: { date: string; checkedIn: boolean; isToday: boolean }[];
}) {
  const { t } = useTranslation();
  return (
    <div className='rounded-2xl bg-zinc-900 p-5'>
      <div className='flex items-center gap-3'>
        <Icons.trendingUp className='size-8 text-orange-500' />
        <div>
          <p className='text-xl font-bold'>
            {current} {t('achievements.streak')}
          </p>
          <p className='text-xs text-zinc-400'>
            {`${t('achievements.best')}:`} {best} {t('achievements.days')}
          </p>
        </div>
      </div>
      <div className='mt-4 flex justify-between px-1'>
        {WEEKDAY_LABELS.map((label, i) => {
          const day = weekDays[i];
          return (
            <div key={i} className='flex flex-col items-center gap-2'>
              <span className='text-[10px] font-semibold text-zinc-500'>{label}</span>
              <div
                className={
                  day?.isToday
                    ? 'flex size-4 items-center justify-center rounded-full border-2 border-zinc-900 bg-white outline outline-2 outline-white'
                    : day?.checkedIn
                      ? 'size-3 rounded-full bg-white'
                      : 'size-3 rounded-full bg-zinc-700'
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
