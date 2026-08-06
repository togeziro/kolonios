import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import { nationalHolidaysQueryOptions } from '@/features/holiday-calendar/api/queries';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';

// Holiday indicator styles
const holidayStyles = `
  .holiday-date button::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: hsl(var(--destructive));
  }
`;

interface HolidayCalendarViewProps {
  year?: number;
}

export function HolidayCalendarView({ year: initialYear }: HolidayCalendarViewProps) {
  const [selectedYear, setSelectedYear] = React.useState(initialYear ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();

  // Fetch holidays for the selected year
  const { data, isLoading, error } = useQuery(nationalHolidaysQueryOptions(selectedYear));

  // Create a map of dates to holidays for quick lookup
  const holidayMap = React.useMemo(() => {
    const map = new Map<string, NationalHoliday[]>();
    const holidays = data?.holidays ?? [];
    holidays.forEach((holiday) => {
      const dateStr = holiday.date;
      const existing = map.get(dateStr) ?? [];
      map.set(dateStr, [...existing, holiday]);
    });
    return map;
  }, [data?.holidays]);

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

  return (
    <div className='space-y-4'>
      <style>{holidayStyles}</style>
      {/* Calendar Header with Navigation */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <button
            onClick={goToPreviousYear}
            className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0'
            aria-label='Previous year'
          >
            <Icons.chevronLeft className='h-4 w-4' />
            <Icons.chevronLeft className='h-4 w-4 -ml-2' />
          </button>
          <button
            onClick={goToPreviousMonth}
            className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0'
            aria-label='Previous month'
          >
            <Icons.chevronLeft className='h-4 w-4' />
          </button>
        </div>

        <div className='text-center'>
          <h3 className='text-lg font-semibold'>
            {new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' })}{' '}
            {selectedYear}
          </h3>
          <p className='text-sm text-muted-foreground'>
            {data?.holidays?.length ?? 0} holiday{(data?.holidays?.length ?? 0) !== 1 ? 's' : ''}{' '}
            this year
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={goToNextMonth}
            className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0'
            aria-label='Next month'
          >
            <Icons.chevronRight className='h-4 w-4' />
          </button>
          <button
            onClick={goToNextYear}
            className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0'
            aria-label='Next year'
          >
            <Icons.chevronRight className='h-4 w-4' />
            <Icons.chevronRight className='h-4 w-4 -ml-2' />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className='p-3'>
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
              className='w-full'
              modifiers={holidayModifiers}
              modifiersClassNames={{
                holiday: 'holiday-date'
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
