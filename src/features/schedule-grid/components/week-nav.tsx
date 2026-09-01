import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { formatWeekRangeLabel } from '../utils/date-utils';

export type WeekNavProps = {
  weekStart: string;
  weekEnd: string;
  month: string;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  /** Jump to the week containing `yyyy-MM-dd`. */
  onPickDate: (date: string) => void;
  /** True when the visible week contains today. Drives `aria-current`
   * on the Today button (set only when the button reflects the visible
   * week, per the a11y spec). */
  isCurrentWeek?: boolean;
  /** Min/max date the picker should expose (e.g. clamp to data range). */
  minDate?: string;
  maxDate?: string;
};

// `aria-current` value semantic for the "Today" button — matches the HTML
// spec token used elsewhere (`/docs/holiday-calendar/components/holiday-calendar-view.tsx`).
const TODAY_ARIA = 'date' as const;

/**
 * Toolbar above the schedule grid: Prev / Today / Next buttons, a date
 * picker that snaps to the week containing the chosen date, and a
 * "Aug 25 – Aug 31, 2026" style range label.
 *
 * The month-year picker is intentionally a native `<input type="month">`
 * behind a `<NativeSelect>` wrapper — keeps the bundle small, accessible
 * by default, and free of Popover/Calendar dependencies that ticket 02/03
 * may want to upgrade later (e.g. shadcn Calendar).
 */
export function WeekNav({
  weekStart,
  weekEnd,
  month,
  onPrev,
  onToday,
  onNext,
  onPickDate,
  isCurrentWeek = false,
  minDate,
  maxDate
}: WeekNavProps) {
  const { t } = useTranslation();

  // The picker operates on YYYY-MM (a real <input type="month"> would be
  // nicer but its keyboard/UX varies wildly across browsers; a custom
  // month grid is out of scope for ticket 01). We derive the pickable
  // year from the current week and emit a date string in the middle of
  // that month so onPickDate can snap to the right week.
  const pickerMonth = month;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2')}
      role='toolbar'
      aria-label={t('scheduleGrid.nav.toolbarLabel')}
    >
      <Button variant='outline' size='sm' onClick={onPrev} aria-label={t('scheduleGrid.nav.prev')}>
        <ChevronLeft className='size-4' />
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onToday}
        aria-current={isCurrentWeek ? TODAY_ARIA : undefined}
        aria-label={t('scheduleGrid.nav.today')}
      >
        {t('scheduleGrid.nav.today')}
      </Button>
      <Button variant='outline' size='sm' onClick={onNext} aria-label={t('scheduleGrid.nav.next')}>
        <ChevronRight className='size-4' />
      </Button>

      <NativeSelect
        aria-label={t('scheduleGrid.nav.monthPickerLabel')}
        className='h-9 w-40'
        value={pickerMonth}
        onChange={(event) => {
          const next = event.target.value;
          // Snap to the 15th of the chosen month — always inside the month.
          onPickDate(`${next}-15`);
        }}
      >
        {buildMonthOptions(minDate, maxDate).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </NativeSelect>

      <div className='ml-auto text-sm font-medium tabular-nums text-muted-foreground'>
        {formatWeekRangeLabel(weekStart, weekEnd)}
      </div>
    </div>
  );
}

function buildMonthOptions(
  minDate?: string,
  maxDate?: string
): Array<{ value: string; label: string }> {
  // Anchor: start from the min/max if provided, else +/- 1 year from now.
  const now = new Date();
  const anchorYear = now.getUTCFullYear();
  const minYear = minDate ? Number(minDate.slice(0, 4)) : anchorYear - 1;
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : anchorYear + 1;
  const monthFmt = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const out: Array<{ value: string; label: string }> = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, '0')}`;
      const label = monthFmt.format(new Date(Date.UTC(year, month - 1, 1)));
      out.push({ value, label });
    }
  }
  return out;
}
