import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useNationalHolidays } from '@/features/holiday-calendar/api/queries';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { dateFnsLocale, formatLongDate } from '@/lib/format';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { DayButtonProps } from 'react-day-picker';
import { HolidayFormDialog } from './holiday-form-dialog';
import { useImportHolidaysFromApi } from '../api/mutations';
import { toast } from 'sonner';
import { CalendarX2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

interface HolidayCalendarViewProps {
  year?: number;
}

export function HolidayCalendarView({ year: initialYear }: HolidayCalendarViewProps) {
  const { t, i18n } = useTranslation();
  // Calendar follows the visible UI language, not the server locale setting,
  // so day names, weekday headers, and month title match the language switcher.
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  const [selectedYear, setSelectedYear] = React.useState(initialYear ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  // Auto-select today so users immediately see the current date highlighted
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => new Date());
  const [formOpen, setFormOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const importMutation = useImportHolidaysFromApi();

  // Fetch holidays for the selected year
  const { data, isLoading, error } = useNationalHolidays(selectedYear);

  // Create a map of dates to holidays for quick lookup.
  // Recurring holidays store an absolute date; project them onto the viewed year
  // so e.g. a recurring Jan 1 holiday renders on Jan 1 of whatever year is shown.
  const holidayMap = React.useMemo(() => {
    const map = new Map<string, NationalHoliday[]>();
    const holidays = data?.holidays ?? [];
    holidays.forEach((holiday: NationalHoliday) => {
      const dateStr = holiday.is_recurring
        ? projectDateOntoYear(holiday.date, selectedYear)
        : holiday.date;
      if (!dateStr) return;
      const existing = map.get(dateStr) ?? [];
      map.set(dateStr, [...existing, holiday]);
    });
    return map;
  }, [data?.holidays, selectedYear]);

  // Get holidays for a specific date
  const getHolidaysForDate = (date: Date): NationalHoliday[] => {
    const dateStr = formatDate(date);
    return holidayMap.get(dateStr) ?? [];
  };

  // Create modifiers for holiday dates
  const holidayModifiers = React.useMemo(() => {
    const dates: Date[] = [];
    holidayMap.forEach((_, dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    });
    return { holiday: dates };
  }, [holidayMap]);

  // Handle month/year navigation
  const handleMonthChange = (month: Date) => {
    setSelectedMonth(month.getMonth());
    setSelectedYear(month.getFullYear());
    setSelectedDate(undefined);
  };

  // Navigation handlers
  const goToPreviousMonth = () => {
    setSelectedDate(undefined);
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };
  const goToNextMonth = () => {
    setSelectedDate(undefined);
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setSelectedDate(undefined);
  };

  // Dismiss the details panel with Escape
  React.useEffect(() => {
    if (!selectedDate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDate(undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDate]);

  // Get selected date's holidays
  const selectedDateHolidays = selectedDate ? getHolidaysForDate(selectedDate) : [];

  // Count total holidays in the selected year (recurring projected onto selectedYear)
  const yearHolidayCount = React.useMemo(() => {
    let count = 0;
    holidayMap.forEach((holidays, dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime()) && date.getFullYear() === selectedYear) {
        count += holidays.length;
      }
    });
    return count;
  }, [holidayMap, selectedYear]);

  // Calculate holiday count for current month (recurring dates projected onto selectedYear)
  const currentMonthHolidayCount = React.useMemo(() => {
    let count = 0;
    holidayMap.forEach((holidays, dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      if (
        !isNaN(date.getTime()) &&
        date.getMonth() === selectedMonth &&
        date.getFullYear() === selectedYear
      ) {
        count += holidays.length;
      }
    });
    return count;
  }, [holidayMap, selectedMonth, selectedYear]);

  // Dense day cell: day number (with today ring) + holiday name pill, like the
  // reference dashboard's event pills. Sundays render red like the traditional
  // Indonesian kalender so the weekly day off is readable at a glance.
  // Today gets a solid green circle + "Today" badge so the current date is
  // unmissable. Stays stable unless holiday data changes.
  const dayComponents = React.useMemo(() => {
    function DayButton({ day, modifiers, ...buttonProps }: DayButtonProps) {
      const holidays = holidayMap.get(day.isoDate) ?? [];
      const isToday = Boolean(modifiers.today);
      const isSunday = Boolean(modifiers.sunday);
      const names = holidays.map((holiday) => holiday.name).join(', ');
      const baseLabel = buttonProps['aria-label'];

      return (
        <button
          {...buttonProps}
          aria-current={isToday ? 'date' : undefined}
          aria-label={names ? `${baseLabel} - ${names}` : baseLabel}
          className={cn(
            buttonProps.className,
            'flex h-full w-full flex-col items-center justify-center gap-0.5 p-1'
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-sm',
              isToday
                ? 'bg-emerald-500 font-semibold text-white ring-2 ring-emerald-500/40 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-400/40'
                : isSunday
                  ? 'text-destructive'
                  : undefined
            )}
          >
            {day.date.getDate()}
          </span>
          {isToday && (
            <span className='rounded-full bg-emerald-500/15 px-1.5 py-px text-xs leading-none font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'>
              {t('common.today')}
            </span>
          )}
          {holidays.length > 0 && (
            <span className='w-full max-w-full truncate rounded-sm bg-destructive/15 px-1 py-px text-start text-xs leading-tight font-medium text-destructive'>
              {holidays.length === 1
                ? holidays[0].name
                : `${holidays[0].name} +${holidays.length - 1}`}
            </span>
          )}
        </button>
      );
    }
    return { DayButton };
  }, [holidayMap, t]);

  const handleImport = () => {
    importMutation.mutate(
      { year: new Date().getFullYear() },
      {
        onSuccess: (result) => {
          toast.success(t('holiday.importSuccess', { count: result.count }));
          setImportOpen(false);
        },
        onError: () => {
          toast.error(t('holiday.importFailed'));
        }
      }
    );
  };

  return (
    <div className='flex flex-col overflow-hidden rounded-md border'>
      {/* Header bar */}
      <div className='flex flex-col gap-4 border-b bg-sidebar p-4 text-sidebar-foreground lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex min-w-0 shrink-0 flex-col gap-1'>
          <div className='text-lg leading-none font-medium'>
            {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
              new Date(selectedYear, selectedMonth)
            )}
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('holiday.monthSummary', {
              days: daysInMonth(selectedYear, selectedMonth),
              count: currentMonthHolidayCount,
              year: yearHolidayCount
            })}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button size='sm' onClick={() => setFormOpen(true)}>
            <Icons.add />
            {t('holiday.addHoliday')}
          </Button>
          <div className='flex items-center overflow-hidden rounded-md border'>
            <Button
              variant='outline'
              size='icon'
              className='rounded-none border-0'
              onClick={goToPreviousMonth}
              aria-label={t('holiday.previousMonth')}
            >
              <Icons.chevronLeft className='h-4 w-4' />
            </Button>
            <Button variant='outline' className='rounded-none border-x-0' onClick={handleToday}>
              {t('common.today')}
            </Button>
            <Button
              variant='outline'
              size='icon'
              className='rounded-none border-0'
              onClick={goToNextMonth}
              aria-label={t('holiday.nextMonth')}
            >
              <Icons.chevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar grid / empty state */}
      <div className='p-3'>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <Icons.spinner className='h-6 w-6 animate-spin' />
          </div>
        ) : error ? (
          <div className='flex h-64 items-center justify-center text-destructive'>
            <p>{t('holiday.loadFailed')}</p>
          </div>
        ) : yearHolidayCount === 0 ? (
          <Card className='mx-auto w-full max-w-2xl'>
            <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
              <CalendarX2 className='mb-4 h-12 w-12 text-muted-foreground/50' />
              <h3 className='mb-1 text-lg font-semibold'>{t('holiday.emptyTitle')}</h3>
              <p className='mb-4 max-w-sm text-sm text-muted-foreground'>
                {t('holiday.emptyDescription')}
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setImportOpen(true)}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Icons.spinner className='animate-spin' />
                  ) : (
                    <Icons.download />
                  )}
                  {t('holiday.importHolidays')}
                </Button>
                <Button size='sm' onClick={() => setFormOpen(true)}>
                  <Icons.add />
                  {t('holiday.addHoliday')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Calendar
            mode='single'
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={new Date(selectedYear, selectedMonth)}
            onMonthChange={handleMonthChange}
            locale={dateFnsLocale(locale)}
            className='w-full'
            modifiers={{
              ...holidayModifiers,
              sunday: (date: Date) => date.getDay() === 0
            }}
            modifiersClassNames={{
              holiday: 'holiday-date',
              sunday: 'sunday-cell'
            }}
            components={dayComponents}
            classNames={{
              root: 'w-full',
              months: 'flex w-full',
              month: 'w-full flex flex-col gap-4',
              weekdays: 'flex w-full',
              weekday: 'flex-1 text-center text-xs font-medium text-muted-foreground',
              week: 'flex w-full',
              day: 'relative min-w-0 flex-1 h-16',
              day_button: 'relative h-full w-full min-w-0 overflow-hidden',
              selected: 'rounded-md ring-2 ring-primary/70',
              today: '',
              nav: 'hidden'
            }}
          />
        )}
      </div>

      {/* Selected date details */}
      {selectedDate && selectedDateHolidays.length > 0 && (
        <div className='border-t p-4'>
          <div className='mb-2 flex items-center justify-between gap-2'>
            <h3 className='font-semibold'>{formatLongDate(selectedDate, locale)}</h3>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              onClick={() => setSelectedDate(undefined)}
              aria-label={t('common.close')}
            >
              <Icons.close className='h-4 w-4' />
            </Button>
          </div>
          <div className='space-y-2'>
            {selectedDateHolidays.map((holiday) => (
              <div key={holiday.id} className='rounded-md border p-3'>
                <div className='flex items-start justify-between'>
                  <div>
                    <p className='font-medium'>{holiday.name}</p>
                    {holiday.description && (
                      <p className='text-muted-foreground mt-1 text-sm'>{holiday.description}</p>
                    )}
                  </div>
                  <div className='flex gap-1'>
                    {holiday.is_recurring && (
                      <Badge variant='secondary'>{t('holiday.recurring')}</Badge>
                    )}
                    {holiday.source === 'imported' && (
                      <Badge variant='outline'>{t('holiday.imported')}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3 text-sm text-muted-foreground'>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-[0.25rem] bg-destructive' />
          <span>{t('holiday.legendHoliday')}</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-[0.25rem] border border-destructive' />
          <span>{t('holiday.legendRecurringHoliday')}</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-[0.25rem] bg-destructive/10' />
          <span>{t('holiday.legendSunday')}</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='size-2.5 rounded-full bg-emerald-500' />
          <span>{t('common.today')}</span>
        </div>
      </div>

      <HolidayFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('holiday.importConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('holiday.importConfirmDescription', { year: new Date().getFullYear() })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? t('holiday.importing') : t('holiday.importConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Re-project a stored YYYY-MM-DD date onto a target year (for recurring holidays).
function projectDateOntoYear(date: string, targetYear: number): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${targetYear}-${match[2]}-${match[3]}`;
}
