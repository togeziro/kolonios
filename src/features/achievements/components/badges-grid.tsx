import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { AchievementBadge } from '../utils/evaluate';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Icons.phone,
  sun: Icons.sun,
  clock: Icons.clock,
  badgeCheck: Icons.badgeCheck,
  moon: Icons.moon
};

const BADGE_KEY_MAP: Record<string, string> = {
  olt_master: 'oltMaster',
  early_bird: 'earlyBird',
  fast_finisher: 'fastFinisher',
  all_rounder: 'allRounder',
  reliable: 'reliable',
  night_owl: 'nightOwl'
};

export function BadgesGrid({
  badges,
  recentUnlocks
}: {
  badges: AchievementBadge[];
  recentUnlocks: { badgeKey: string; unlockedAt: string }[];
}) {
  const { t } = useTranslation();

  const badgeTitle = (badge: AchievementBadge): string => {
    const key = BADGE_KEY_MAP[badge.key];
    return key ? t(`achievements.${key}`) : badge.title;
  };
  const badgeDescription = (badge: AchievementBadge): string => {
    const key = BADGE_KEY_MAP[badge.key];
    return key ? t(`achievements.${key}Desc`) : badge.description;
  };

  return (
    <div>
      {recentUnlocks.length > 0 && (
        <div className='mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3'>
          {recentUnlocks.map((unlock) => {
            const badge = badges.find((b) => b.key === unlock.badgeKey);
            return (
              <div key={unlock.badgeKey} className='flex items-center gap-3'>
                <Icons.badgeCheck className='size-5 text-white' />
                <p className='text-sm font-medium text-zinc-300'>
                  {badge && <span className='font-bold text-white'>{badgeTitle(badge)}</span>}
                  {` · ${t('achievements.unlockedYesterday')}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className='mb-4 px-1 text-lg font-bold'>{t('achievements.badges')}</p>
      <div className='grid grid-cols-2 gap-3'>
        {badges.map((badge) => {
          const IconComponent = ICON_MAP[badge.icon] ?? Icons.badgeCheck;
          return (
            <div
              key={badge.key}
              data-locked={!badge.unlocked ? '' : undefined}
              className={cn(
                'relative flex flex-col items-center rounded-2xl p-4 text-center',
                badge.unlocked
                  ? 'bg-zinc-900'
                  : 'border border-zinc-800/50 bg-zinc-900/50 opacity-60'
              )}
            >
              {!badge.unlocked && (
                <Icons.lock className='absolute right-3 top-3 size-4 text-zinc-500' />
              )}
              <div
                className={cn(
                  'mb-1 flex size-12 items-center justify-center rounded-full',
                  badge.unlocked ? 'bg-zinc-800' : 'bg-zinc-900'
                )}
              >
                <IconComponent
                  className={cn('size-6', badge.unlocked ? 'text-white' : 'text-zinc-500')}
                />
              </div>
              <h4 className='text-sm font-bold leading-tight'>{badgeTitle(badge)}</h4>
              <p className='text-[11px] leading-snug text-zinc-400'>{badgeDescription(badge)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
