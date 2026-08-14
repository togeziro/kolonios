import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import type { TicketStatus } from '../api/types';

const REWORK_STATUSES: TicketStatus[] = ['rejected', 'rework'];

export function getReworkNote(ticket: {
  status: TicketStatus;
  reviewNote: string | null;
}): string | null {
  if (!REWORK_STATUSES.includes(ticket.status)) return null;
  const note = ticket.reviewNote?.trim();
  return note ? note : null;
}

export default function ReworkBanner({ note }: { note: string }) {
  const { t } = useTranslation();
  return (
    <Card className='space-y-1 rounded-2xl border-red-800/40 bg-red-950/30 p-4 dark:bg-red-950/30'>
      <div className='flex items-center gap-2'>
        <Icons.warning className='h-4 w-4 text-red-400' />
        <p className='text-xs font-bold text-red-300'>{t('ticket.reworkBanner')}</p>
      </div>
      <p className='text-sm leading-relaxed text-red-200/90'>{note}</p>
    </Card>
  );
}
