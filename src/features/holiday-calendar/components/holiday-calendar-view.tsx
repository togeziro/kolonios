import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useNationalHolidays } from '@/features/holiday-calendar/api/queries';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';

interface HolidayCalendarViewProps {
  year?: number;
}

export function HolidayCalendarView({ year: initialYear }: HolidayCalendarViewProps) {
  const [selectedYear, setSelectedYear] = React.useState(initialYear ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

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
  };

  // Navigation handlers
  const goToPreviousYear = () => setSelectedYear((prev) => prev - 1);
  const goToNextYear = () => setSelectedYear((prev) => prev + 1);
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

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

  return (
    <div className='space-y-4'>
      {/* Calendar Header with Navigation */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={goToPreviousYear}
            aria-label='Previous year'
          >
            <Icons.chevronsLeft className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={goToPreviousMonth}
            aria-label='Previous month'
          >
            <Icons.chevronLeft className='h-4 w-4' />
          </Button>
        </div>

        <div className='text-center'>
          <p className='text-sm text-muted-foreground'>
            {currentMonthHolidayCount} holiday{currentMonthHolidayCount !== 1 ? 's' : ''} this month
            {' · '}
            {yearHolidayCount} total this year
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <Button variant='outline' size='icon' onClick={goToNextMonth} aria-label='Next month'>
            <Icons.chevronRight className='h-4 w-4' />
          </Button>
          <Button variant='outline' size='icon' onClick={goToNextYear} aria-label='Next year'>
            <Icons.chevronsRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='flex h-64 items-center justify-center'>
              <Icons.spinner className='h-6 w-6 animate-spin' />
            </div>
          ) : error ? (
            <div className='flex h-64 items-center justify-center text-destructive'>
              <p>Failed to load holidays</p>
            </div>
          ) : (
            <Calendar
              mode='single'
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={new Date(selectedYear, selectedMonth)}
              onMonthChange={handleMonthChange}
              className='w-full p-3'
              modifiers={holidayModifiers}
              modifiersClassNames={{
                holiday: 'holiday-date'
              }}
              classNames={{
                root: 'w-full',
                months: 'flex w-full',
                month: 'w-full flex flex-col gap-4',
                weekdays: 'flex w-full',
                weekday: 'flex-1 text-center text-xs font-medium text-muted-foreground',
                week: 'flex w-full',
                day: 'flex-1 h-10',
                day_button: 'w-full h-full',
                nav: 'hidden'
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && selectedDateHolidays.length > 0 && (
        <Card>
          <CardContent className='p-4'>
            <h4 className='font-semibold mb-2'>
              {selectedDate.toLocaleDateString('default', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h4>
            <div className='space-y-2'>
              {selectedDateHolidays.map((holiday) => (
                <div key={holiday.id} className='rounded-md border p-3'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='font-medium'>{holiday.name}</p>
                      {holiday.description && (
                        <p className='text-sm text-muted-foreground mt-1'>{holiday.description}</p>
                      )}
                    </div>
                    <div className='flex gap-1'>
                      {holiday.is_recurring && <Badge variant='secondary'>Recurring</Badge>}
                      {holiday.source === 'imported' && <Badge variant='outline'>Imported</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday Legend */}
      <div className='flex items-center gap-4 text-sm text-muted-foreground'>
        <div className='flex items-center gap-1'>
          <div className='h-2 w-2 rounded-full bg-destructive' />
          <span>Holiday</span>
        </div>
        <div className='flex items-center gap-1'>
          <Badge variant='secondary' className='text-xs'>
            Recurring
          </Badge>
          <span>Recurring holiday</span>
        </div>
      </div>
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

// Re-project a stored YYYY-MM-DD date onto a target year (for recurring holidays).
function projectDateOntoYear(date: string, targetYear: number): string | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${targetYear}-${match[2]}-${match[3]}`;
}
