'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { auditLogQueryOptions } from '../api/queries';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function AuditLogPage() {
  const { t } = useTranslation();
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  const { data, isFetching } = useQuery(auditLogQueryOptions({ perPage: 100, action: search }));

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={t('audit.filterByAction')}
          className='max-w-sm'
        />
        <Button variant='outline' onClick={() => setSearch(action)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Apply'}
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
