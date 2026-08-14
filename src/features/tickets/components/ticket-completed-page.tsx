import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { IconStar } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useAppLocale } from '@/lib/locale';
import { formatDate } from '@/lib/format';
import { ticketDetailQueryOptions } from '../api/queries';
import LegTimeline from './leg-timeline';
import type { TicketMaterial } from '../api/types';

export function totalMaterialQty(materials: TicketMaterial[]): number {
  return materials.reduce((sum, m) => sum + m.qty, 0);
}

export default function TicketCompletedPage({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));

  if (isLoading) {
    return (
      <div className='flex justify-center py-16'>
        <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return (
      <div className='space-y-4 p-4 text-center'>
        <p className='text-muted-foreground text-sm'>{t('ticket.invalidTicket')}</p>
        <Link to='/dashboard/my-work' className='text-xs font-semibold'>
          {t('ticket.seeAll')}
        </Link>
      </div>
    );
  }

  return (
    <div className='space-y-4 p-4'>
      <div className='space-y-3 text-center'>
        <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15'>
          <Icons.check className='h-8 w-8 text-green-500' />
        </div>
        <div>
          {ticket.ticketCode && (
            <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {ticket.ticketCode}
            </p>
          )}
          <h2 className='dark:text-white text-lg font-bold leading-tight'>{ticket.title}</h2>
          <p className='text-muted-foreground mt-1 text-xs'>{t('ticket.completedTitle')}</p>
        </div>
      </div>

      {ticket.rating != null && (
        <Card className='dark:border-zinc-800/50 space-y-2 rounded-2xl p-4 dark:bg-zinc-900'>
          <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
            {t('ticket.rating')}
          </p>
          <div className='flex gap-1'>
            {[1, 2, 3, 4, 5].map((n) => (
              <IconStar
                key={n}
                className={`h-5 w-5 ${n <= ticket.rating! ? 'text-amber-400' : 'text-zinc-600'}`}
              />
            ))}
          </div>
        </Card>
      )}

      {ticket.materials.length > 0 && (
        <Card className='dark:border-zinc-800/50 space-y-2 rounded-2xl p-4 dark:bg-zinc-900'>
          <div className='flex items-center justify-between'>
            <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
              {t('ticket.materials')}
            </p>
            <span className='text-xs font-bold text-muted-foreground'>
              {totalMaterialQty(ticket.materials)} {t('ticket.unitTotal')}
            </span>
          </div>
          <ul className='space-y-2'>
            {ticket.materials.map((m) => (
              <li key={m.id} className='flex items-center justify-between text-sm'>
                <span className='dark:text-zinc-300'>
                  {m.materialName}{' '}
                  <span className='text-muted-foreground text-xs'>
                    {t('ticket.materialsLegTag', { name: m.legName })}
                  </span>
                </span>
                <Badge
                  variant='outline'
                  className='dark:bg-zinc-800 h-5 rounded-full px-2 text-[10px] font-bold dark:text-zinc-400'
                >
                  {m.qty} {m.unit}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
        <h3 className='dark:text-white text-sm font-semibold'>{t('ticket.legs')}</h3>
        <LegTimeline legs={ticket.legs} />
        {ticket.completedAt && (
          <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
            {t('ticket.completedAt', { when: formatDate(ticket.completedAt, undefined, locale) })}
          </p>
        )}
      </Card>
    </div>
  );
}
