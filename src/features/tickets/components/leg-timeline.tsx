import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { TicketLeg, TicketLegStatus } from '../api/types';

export function progressFromLegs(legs: TicketLeg[]): string {
  const done = legs.filter((l) => l.status === 'approved' || l.status === 'completed').length;
  return `${done}/${legs.length}`;
}

const legStatusBadge: Partial<Record<TicketLegStatus, 'outline' | 'secondary' | 'default'>> = {
  assigned: 'outline',
  in_progress: 'default',
  approved: 'secondary'
};

export default function LegTimeline({ legs }: { legs: TicketLeg[] }) {
  const { t } = useTranslation();
  if (legs.length === 0) {
    return <p className='text-muted-foreground text-sm'>{t('ticket.noLegs')}</p>;
  }
  return (
    <ol className='space-y-3'>
      {legs.map((leg) => (
        <li key={leg.id} className='flex gap-3'>
          <div className='flex flex-col items-center'>
            <span className='dark:bg-zinc-800 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold dark:text-zinc-300'>
              {leg.legNumber}
            </span>
            <span className='dark:bg-zinc-700/50 w-px flex-1' />
          </div>
          <div className='flex flex-1 flex-col gap-1 pb-2'>
            <div className='flex items-center justify-between'>
              <p className='dark:text-white text-sm font-semibold'>{leg.name}</p>
              <Badge
                variant={legStatusBadge[leg.status]}
                className='dark:bg-zinc-800 h-5 rounded-full px-2 text-[10px] font-bold dark:text-zinc-400'
              >
                {leg.status.replace('_', ' ')}
              </Badge>
            </div>
            {leg.description && <p className='text-muted-foreground text-xs'>{leg.description}</p>}
            {leg.completedAt && (
              <p className='text-muted-foreground text-[10px]'>
                {t('ticket.legDoneAt', {
                  when: new Date(leg.completedAt).toLocaleString()
                })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
