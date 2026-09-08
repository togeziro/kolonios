import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { completedLegCount } from './leg-timeline';
import ElapsedTimer from './elapsed-timer';
import type { TicketDetail } from '../api/types';

export default function TicketDetailOverviewTab({
  ticket,
  domainLabel
}: {
  ticket: TicketDetail;
  domainLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className='dark:border-zinc-800/50 space-y-3 rounded-2xl p-4 dark:bg-zinc-900'>
      <div className='flex flex-wrap gap-2'>
        <Badge className='h-6 rounded-full px-3 text-[11px] font-bold'>{ticket.priority}</Badge>
        <Badge variant='outline' className='h-6 rounded-full px-3 text-[11px] font-bold'>
          {domainLabel}
        </Badge>
      </div>
      <Progress
        value={(completedLegCount(ticket.legs) / Math.max(ticket.legs.length, 1)) * 100}
        className='h-1.5 dark:bg-zinc-800'
      />
      <ElapsedTimer takenAt={ticket.takenAt} />
      <p className='text-xs text-muted-foreground'>{t('ticket.overviewHint')}</p>
    </Card>
  );
}
