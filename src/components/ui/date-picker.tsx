import * as React from 'react';
import { format } from 'date-fns';
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
  className?: string;
}

export function DatePicker({
  id,
  ariaLabel,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  className
}: DatePickerProps) {
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
          {value ? format(new Date(value), 'PPP') : <span>{placeholder}</span>}
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
          mode='single'
          selected={selectedDate}
          onSelect={handleSelect}
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
  className?: string;
}

export function DatePickerRange({
  value,
  onChange,
  placeholder = 'Select date range',
  disabled = false,
  className
}: DatePickerRangeProps) {
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
      ? `${format(new Date(value.from), 'PPP')} - ${format(new Date(value.to), 'PPP')}`
      : `From ${format(new Date(value.from), 'PPP')}`
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
        <Calendar mode='range' selected={dateRange} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
