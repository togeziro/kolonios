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
  /** Zero-padded month of the visible week, e.g. `08`. */
  month: string;
  /** Four-digit year of the visible week, e.g. `2026`. */
  year: string;
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
 * Toolbar above the schedule grid: Prev / Today / Next buttons, separate
 * Month + Year pickers that snap to the week containing the 15th of the
 * chosen month, and a "Aug 25 – Aug 31, 2026" style range label.
 *
 * Kerjoo parity (ticket 01): the picker is two native `<select>`s — Month
 * (`January…December`) and Year (`2025, 2026, 2027…`) — mirroring the
 * `e47`/`e60` comboboxes. Selecting either fires `onPickDate` with a
 * `YYYY-MM-15` date so the parent can snap to the correct week.
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
  year,
  onPrev,
  onToday,
  onNext,
  onPickDate,
  isCurrentWeek = false,
  minDate,
  maxDate
}: WeekNavProps) {
  const { t } = useTranslation();

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
        {t('scheduleGrid.nav.prevWeek')}
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
        {t('scheduleGrid.nav.nextWeek')}
        <ChevronRight className='size-4' />
      </Button>

      <NativeSelect
        aria-label={t('scheduleGrid.nav.monthPickerLabel')}
        className='h-9 w-36'
        value={month}
        onChange={(event) => {
          // Snap to the 15th of the chosen month — always inside the month.
          onPickDate(`${year}-${event.target.value}-15`);
        }}
      >
        {buildMonthOptions().map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label={t('scheduleGrid.nav.yearPickerLabel')}
        className='h-9 w-28'
        value={year}
        onChange={(event) => {
          // Keep the month, snap to the 15th of the chosen year's month.
          onPickDate(`${event.target.value}-${month}-15`);
        }}
      >
        {buildYearOptions(minDate, maxDate).map((opt) => (
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

function buildMonthOptions(): Array<{ value: string; label: string }> {
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
  const out: Array<{ value: string; label: string }> = [];
  for (let month = 1; month <= 12; month += 1) {
    const value = String(month).padStart(2, '0');
    const label = monthFmt.format(new Date(Date.UTC(2020, month - 1, 1)));
    out.push({ value, label });
  }
  return out;
}

function buildYearOptions(
  minDate?: string,
  maxDate?: string
): Array<{ value: string; label: string }> {
  // Anchor: start from the min/max if provided, else ±2 years from now.
  const now = new Date();
  const anchorYear = now.getUTCFullYear();
  const minYear = minDate ? Number(minDate.slice(0, 4)) : anchorYear - 2;
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : anchorYear + 2;

  const out: Array<{ value: string; label: string }> = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    const value = String(year);
    out.push({ value, label: value });
  }
  return out;
}
