'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { auditLogQueryOptions } from '../api/queries';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

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

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t('audit.filterByAction')}
          className='max-w-sm'
        />
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
          {isFetching ? t('common.loading') : t('common.save')}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>
        {t('audit.recordedActions', { count: total })}
      </p>
      <div className='rounded-lg border'>
        <table className='w-full text-left text-sm'>
          <thead className='bg-muted/50 text-muted-foreground'>
            <tr>
              <th className='p-3 font-medium'>{t('audit.time')}</th>
              <th className='p-3 font-medium'>{t('audit.actor')}</th>
              <th className='p-3 font-medium'>{t('audit.action')}</th>
              <th className='p-3 font-medium'>{t('audit.entity')}</th>
              <th className='p-3 font-medium'>{t('audit.id')}</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className='p-3 whitespace-nowrap'>
                  {format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm')}
                </td>
                <td className='p-3'>{row.actorUserId}</td>
                <td className='p-3 font-mono text-xs'>{row.action}</td>
                <td className='p-3'>{row.entityType}</td>
                <td className='p-3 font-mono text-xs'>{row.entityId ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className='text-muted-foreground p-6 text-center'>
                  {t('audit.noEntries')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
