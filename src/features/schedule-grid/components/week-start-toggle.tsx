import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useWeekStartPreference } from './use-week-start';
import type { WeekStart } from '../utils/constants';

/**
 * Two-button toggle for the schedule-grid's week-start preference.
 *
 * Senin (Mon-Sun) is the default for Indonesian business calendars; Minggu
 * (Sun-Sat) is opt-in. The selection persists per-user in localStorage via
 * the SSR-safe `useWeekStartPreference` hook.
 */
export function WeekStartToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useWeekStartPreference();

  const options: Array<{ value: WeekStart; label: string }> = [
    { value: 'monday', label: t('scheduleGrid.weekStart.monday') },
    { value: 'sunday', label: t('scheduleGrid.weekStart.sunday') }
  ];

  return (
    <div
      role='group'
      aria-label={t('scheduleGrid.weekStart.label')}
      className={cn('inline-flex rounded-md border border-border bg-background p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={active}
            onClick={() => setValue(option.value)}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
