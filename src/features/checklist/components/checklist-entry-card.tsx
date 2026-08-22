import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { myDailyChecklistQueryOptions } from '../api/queries';
import { checklistEntryState, isChecklistViewAllowed } from './entry-state';

export default function ChecklistEntryCard({ variant = 'card' }: { variant?: 'card' | 'chip' }) {
  const { t } = useTranslation();
  const { permissions, isAdmin } = useRoleGroupPermissions();
  const viewAllowed = isChecklistViewAllowed(permissions, isAdmin);
  const { data } = useQuery({
    ...myDailyChecklistQueryOptions(),
    enabled: viewAllowed,
    staleTime: 30_000
  });

  const checklist = data?.checklist ?? null;
  const items = data?.items ?? [];
  const decision = checklistEntryState({ status: checklist?.status ?? null, viewAllowed, variant });
  if (!decision.visible) return null;

  const doneCount = items.filter((i) => i.outcome !== 'pending').length;
  const isAction = decision.tone === 'action';

  const inner =
    variant === 'card' ? (
      <Card className='dark:border-zinc-800/50 flex items-center justify-between gap-3 rounded-2xl p-4 dark:bg-zinc-900'>
        <div className='flex items-center gap-3'>
          <span className='dark:bg-zinc-800 flex h-10 w-10 shrink-0 items-center justify-center rounded-full dark:text-zinc-300'>
            <CalendarCheck className='h-5 w-5' />
          </span>
          <div className='flex flex-col'>
            <h4 className='text-[15px] font-semibold leading-tight dark:text-white'>
              {t('checklist.entryTitle')}
            </h4>
            <span className='dark:text-zinc-500 text-xs text-muted-foreground'>
              {isAction && checklist?.status === 'draft'
                ? t('checklist.progress', { done: doneCount, total: items.length })
                : t(decision.statusKey)}
            </span>
          </div>
        </div>
        <Badge
          variant={isAction ? 'default' : 'secondary'}
          className={`h-5 shrink-0 rounded px-2 text-[10px] font-bold ${
            checklist?.status === 'rejected'
              ? ''
              : isAction
                ? 'border border-emerald-800/50 bg-emerald-950/60 text-emerald-300'
                : 'dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          {t(decision.statusKey)}
        </Badge>
      </Card>
    ) : (
      <Link
        to='/dashboard/daily-checklist'
        className='block rounded-xl border border-amber-800/40 bg-amber-950/30 p-3'
      >
        <div className='flex items-center gap-2'>
          <CalendarCheck className='h-4 w-4 shrink-0 text-amber-400' />
          <span className='text-xs font-medium text-amber-300'>
            {checklist?.status === 'rejected'
              ? t('checklist.chipRejected')
              : t('checklist.chipPending')}
          </span>
          <Icons.chevronRight className='ml-auto h-4 w-4 shrink-0 text-amber-400' />
        </div>
      </Link>
    );

  if (variant === 'chip') return inner;

  return (
    <Link to='/dashboard/daily-checklist' className='block'>
      {inner}
    </Link>
  );
}
