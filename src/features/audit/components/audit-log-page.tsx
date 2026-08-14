'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { appFeatures } from '@/lib/table-features';
import { Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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

  const table = useTable({
    features: appFeatures,
    data: rows,
    columns: auditLogColumns,
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } }
  });

  return (
    <DataTable table={table}>
      <div className='flex flex-wrap items-center gap-2'>
        <InputGroup className='h-7 w-full md:w-64'>
          <InputGroupAddon align='inline-start'>
            <Search className='size-3.5' />
          </InputGroupAddon>
          <InputGroupInput
            className='h-7'
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t('audit.filterByAction')}
          />
        </InputGroup>
        <Select
          value={entityType || 'All'}
          onValueChange={(v) => setEntityType(v === 'All' ? '' : v)}
        >
          <SelectTrigger size='sm' className='w-auto'>
            <span className='text-muted-foreground'>{t('audit.entity')}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='start'>
            <SelectGroup>
              <SelectItem value='All'>{t('audit.allEntities')}</SelectItem>
              {ENTITY_TYPES.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {entity}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button size='sm' variant='outline' onClick={() => setSearch(action)} disabled={isFetching}>
          {isFetching ? t('common.loading') : t('common.search')}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        {t('audit.recordedActions', { count: total })}
      </p>
    </DataTable>
  );
}
