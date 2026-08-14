import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { customersQueryOptions } from '@/features/customers/api/queries';
import { cn } from '@/lib/utils';

export function customerPickerQueryOptions(search: string) {
  return customersQueryOptions({ search, page: 1, limit: 20 });
}

interface CustomerPickerProps {
  value: string | undefined;
  onChange: (customerId: string | undefined) => void;
}

export default function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isFetching } = useQuery({
    ...customerPickerQueryOptions(search),
    placeholderData: (prev) => prev
  });

  const debouncedSearch = useDebouncedCallback((term: string) => setSearch(term), 300);

  const customers = data?.customers ?? [];
  const selected = customers.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
        >
          {selected ? (
            selected.full_name
          ) : (
            <span className='text-muted-foreground'>{t('ticket.selectCustomer')}</span>
          )}
          <Icons.chevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('ticket.searchCustomer')}
            onValueChange={(term) => debouncedSearch(term)}
            className='h-9'
          />
          <CommandList>
            {isFetching && <CommandEmpty>{t('ticket.loading')}</CommandEmpty>}
            {!isFetching && customers.length === 0 && (
              <CommandEmpty>{t('ticket.noCustomers')}</CommandEmpty>
            )}
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.full_name}
                  onSelect={() => {
                    onChange(c.id === value ? undefined : c.id);
                    setOpen(false);
                  }}
                >
                  <Icons.check
                    className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')}
                  />
                  {c.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
