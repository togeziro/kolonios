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
import { unlinkedUsersQueryOptions } from '@/features/users/api/queries';
import { cn } from '@/lib/utils';

export function unlinkedUserPickerQueryOptions(search: string) {
  return unlinkedUsersQueryOptions({ search, page: 1, limit: 20 });
}

export type UnlinkedUserChoice = {
  id: string;
  name: string;
  email: string;
};

interface UnlinkedUserPickerProps {
  value: UnlinkedUserChoice | null;
  onChange: (user: UnlinkedUserChoice | null) => void;
}

/**
 * Combobox over users that have no employee profile yet (the "Pending"
 * badge population). Selecting one hands its identity to the caller —
 * the caller locks name/email instead of letting the operator retype them.
 */
export default function UnlinkedUserPicker({ value, onChange }: UnlinkedUserPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isFetching } = useQuery({
    ...unlinkedUserPickerQueryOptions(search),
    placeholderData: (prev) => prev
  });

  const debouncedSearch = useDebouncedCallback((term: string) => setSearch(term), 300);

  const users = data?.users ?? [];
  const selected = users.find((u) => u.id === value?.id) ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          aria-label={t('employee.linkUserAccount')}
          className='w-full justify-between font-normal'
        >
          {selected ? (
            <span className='truncate'>
              {selected.name} <span className='text-muted-foreground'>{`(${selected.email})`}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>{t('employee.selectUnlinkedUser')}</span>
          )}
          <Icons.chevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('employee.searchUnlinkedUser')}
            onValueChange={(term) => debouncedSearch(term)}
            className='h-9'
          />
          <CommandList>
            {isFetching && <CommandEmpty>{t('ticket.loading')}</CommandEmpty>}
            {!isFetching && users.length === 0 && (
              <CommandEmpty>{t('employee.noUnlinkedUsers')}</CommandEmpty>
            )}
            <CommandGroup>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.email}
                  onSelect={() => {
                    onChange(
                      u.id === value?.id ? null : { id: u.id, name: u.name, email: u.email }
                    );
                    setOpen(false);
                  }}
                >
                  <Icons.check
                    className={cn('mr-2 h-4 w-4', u.id === value?.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className='truncate'>
                    {u.name} <span className='text-muted-foreground'>{`(${u.email})`}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
