import type { RowData, Table } from '@tanstack/react-table';
import type { AppReactTable } from '@/lib/table-features';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { CheckIcon } from '@radix-ui/react-icons';

interface DataTableViewOptionsProps<TData extends RowData> {
  table: AppReactTable<TData>;
}

interface ColumnVisibilityMenuProps<TData extends RowData> {
  table: AppReactTable<TData>;
  trigger?: React.ReactNode;
}

export function ColumnVisibilityMenu<TData extends RowData>({
  table,
  trigger
}: ColumnVisibilityMenuProps<TData>) {
  const { t } = useTranslation();

  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide()),
    [table]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant='outline' size='sm'>
            {t('table.view')}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align='end' className='w-44 p-0'>
        <Command>
          <CommandInput placeholder={t('table.searchColumns')} />
          <CommandList>
            <CommandEmpty>{t('table.noColumnsFound')}</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() => column.toggleVisibility(!column.getIsVisible())}
                >
                  <span className='truncate'>{column.columnDef.meta?.label ?? column.id}</span>
                  <CheckIcon
                    className={cn(
                      'ml-auto size-4 shrink-0',
                      column.getIsVisible() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DataTableViewOptions<TData extends RowData>({
  table
}: DataTableViewOptionsProps<TData>) {
  const { t } = useTranslation();
  return (
    <div className='ml-auto hidden lg:block'>
      <ColumnVisibilityMenu table={table} />
    </div>
  );
}
