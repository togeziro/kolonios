'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { auditLogQueryOptions } from '../api/queries';
import { useTranslation } from 'react-i18next';
import { auditLogColumns } from './audit-log-columns';

const ENTITY_TYPES = ['attendance', 'location', 'task', 'customer', 'employee', 'product', 'user'];

export function AuditLogPage() {
  const { t } = useTranslation();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');

  const { data, isFetching } = useQuery(
    auditLogQueryOptions({ perPage: 100, action: search, entityType: entityType || undefined })
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const table = useReactTable({
    data: rows,
    columns: auditLogColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } }
  });

  return (
    <DataTable table={table}>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative max-w-sm'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t('audit.filterByAction')}
            className='pl-9'
          />
        </div>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className='rounded-md border border-input bg-background px-3 py-2 text-sm'
        >
          <option value=''>{t('audit.allEntities')}</option>
          {ENTITY_TYPES.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
        <Button variant='outline' onClick={() => setSearch(action)} disabled={isFetching}>
          {isFetching ? t('common.loading') : t('common.search')}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        {t('audit.recordedActions', { count: total })}
      </p>
    </DataTable>
  );
}
