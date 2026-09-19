import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { formatLongDate, dateFnsLocale } from '@/lib/format';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface DatePickerProps {
  id?: string;
  ariaLabel?: string;
  value?: string | undefined;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  /**
   * Bounds for the month/year dropdowns (captionLayout="dropdown"). Jumping
   * years via dropdown is what makes 20–30-year jumps (e.g. birth dates)
   * fast; unset means day-picker's default (last 100 years).
   */
  startMonth?: Date;
  endMonth?: Date;
  className?: string;
}

/**
 * Compact native-select styling for the calendar caption dropdowns.
 * day-picker renders plain <select> elements — functional everywhere
 * including mobile, styled to match the app's inputs.
 */
const dropdownClassNames = {
  dropdowns: 'flex items-center justify-center gap-1.5',
  months_dropdown:
    'h-8 rounded-md border border-input bg-background px-1 text-sm shadow-xs outline-none focus-visible:border-ring',
  years_dropdown:
    'h-8 rounded-md border border-input bg-background px-1 text-sm shadow-xs outline-none focus-visible:border-ring'
};

export function DatePicker({
  id,
  ariaLabel,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  startMonth,
  endMonth,
  className
}: DatePickerProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const selectedDate = value ? new Date(value) : undefined;

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date ? format(date, 'yyyy-MM-dd') : undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-label={ariaLabel}
          variant='outline'
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          {value ? formatLongDate(new Date(value)) : <span>{placeholder}</span>}
          {value && (
            <XIcon
              className='ml-auto h-4 w-4 opacity-50 hover:opacity-100'
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(undefined);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          locale={dateFnsLocale(i18n.language)}
          mode='single'
          selected={selectedDate}
          onSelect={handleSelect}
          captionLayout='dropdown'
          startMonth={startMonth}
          endMonth={endMonth}
          classNames={dropdownClassNames}
          disabled={(date) => {
            if (minDate && date < new Date(minDate)) return true;
            if (maxDate && date > new Date(maxDate)) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerRangeProps {
  value?: { from?: string; to?: string } | undefined;
  onChange?: (value: { from?: string; to?: string } | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  startMonth?: Date;
  endMonth?: Date;
  className?: string;
}

export function DatePickerRange({
  value,
  onChange,
  placeholder = 'Select date range',
  disabled = false,
  startMonth,
  endMonth,
  className
}: DatePickerRangeProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const dateRange: DateRange | undefined =
    value?.from || value?.to
      ? {
          from: value.from ? new Date(value.from) : undefined,
          to: value.to ? new Date(value.to) : undefined
        }
      : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    onChange?.(
      range
        ? {
            from: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
            to: range.to ? format(range.to, 'yyyy-MM-dd') : undefined
          }
        : undefined
    );
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const displayText = value?.from
    ? value.to
      ? `${formatLongDate(new Date(value.from))} - ${formatLongDate(new Date(value.to))}`
      : `From ${formatLongDate(new Date(value.from))}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'w-full justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          <span className='truncate'>{displayText}</span>
          {value?.from && (
            <XIcon
              className='ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100'
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(undefined);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          locale={dateFnsLocale(i18n.language)}
          mode='range'
          selected={dateRange}
          onSelect={handleSelect}
          captionLayout='dropdown'
          startMonth={startMonth}
          endMonth={endMonth}
          classNames={dropdownClassNames}
        />
      </PopoverContent>
    </Popover>
  );
}
