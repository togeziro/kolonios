import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

function ComboboxField({
  value,
  onChange,
  onBlur,
  isTouched,
  isValid,
  frameworkOptions
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  isTouched: boolean;
  isValid: boolean;
  frameworkOptions: { value: string; label: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const selected = frameworkOptions.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-controls='framework-listbox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
          aria-invalid={isTouched && !isValid}
          onBlur={onBlur}
        >
          {selected?.label ?? 'Search frameworks...'}
          <Icons.chevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
        <Command>
          <CommandInput placeholder='Search...' />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworkOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(val) => {
                    onChange(val);
                    setOpen(false);
                  }}
                >
                  <Icons.check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { ComboboxField };
