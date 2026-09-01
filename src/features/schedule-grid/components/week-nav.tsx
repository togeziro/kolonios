import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';
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
 *
 * Ticket 04: keyboard shortcuts wired on the toolbar's `onKeyDown`.
 * `←` jumps to the previous week, `→` to the next week, `T` (or `t`)
 * snaps to the current week. Shortcuts only fire when focus is on the
 * toolbar or a descendant, so they don't clash with typing in inputs.
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

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Don't hijack typing inside form controls (search, select, etc.).
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNext();
    } else if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      onToday();
    }
  };

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2')}
      role='toolbar'
      aria-label={t('scheduleGrid.nav.toolbarLabel')}
      aria-keyshortcuts='ArrowLeft ArrowRight T'
      tabIndex={0}
      onKeyDown={handleToolbarKeyDown}
    >
      <Button
        variant='outline'
        size='sm'
        onClick={onPrev}
        aria-label={t('scheduleGrid.nav.prev')}
        aria-keyshortcuts='ArrowLeft'
      >
        <ChevronLeft className='size-4' />
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onToday}
        aria-current={isCurrentWeek ? TODAY_ARIA : undefined}
        aria-label={t('scheduleGrid.nav.today')}
        aria-keyshortcuts='T'
      >
        {t('scheduleGrid.nav.today')}
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={onNext}
        aria-label={t('scheduleGrid.nav.next')}
        aria-keyshortcuts='ArrowRight'
      >
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
