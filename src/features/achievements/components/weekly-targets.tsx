import { useTranslation } from 'react-i18next';

export function WeeklyTargets({
  targets
}: {
  targets: { label: string; current: number; target: number }[];
}) {
  const { t } = useTranslation();
  return (
    <div className='rounded-2xl bg-zinc-900 p-5'>
      <p className='mb-4 text-sm font-bold'>{t('achievements.weeklyTargets')}</p>
      <div className='flex flex-col gap-4'>
        {targets.map((target) => (
          <div key={target.label} className='flex flex-col gap-2'>
            <div className='flex items-end justify-between'>
              <span className='text-sm font-medium text-zinc-300'>
                {t(`achievements.${target.label}`)}
              </span>
              <span className='text-xs font-medium text-zinc-400'>
                {`${target.current}/${target.target}`}
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-zinc-800'>
              <div
                className='h-full rounded-full bg-white'
                style={{ width: `${Math.min(100, (target.current / target.target) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
