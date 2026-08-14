import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { myTicketsQueryOptions, completedTicketsQueryOptions } from '../api/queries';
import TicketCard from './ticket-card';
import AvailableTab from './available-tab';
import type { Ticket } from '../api/types';

export function groupMyWork(tickets: Ticket[]): {
  active: Ticket[];
  upcoming: Ticket[];
  pendingApproval: Ticket[];
} {
  return {
    active: tickets.filter((t) => t.status === 'in_progress'),
    upcoming: tickets.filter((t) => t.status === 'assigned'),
    pendingApproval: tickets.filter((t) => t.status === 'submitted')
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2.5'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className='text-muted-foreground py-4 text-center text-sm'>{label}</p>;
}

export default function MyWorkPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('in_progress');
  const { data: myData } = useQuery(myTicketsQueryOptions());
  const { data: completedData } = useQuery(completedTicketsQueryOptions());

  const myTickets = myData?.tickets ?? [];
  const { active, upcoming, pendingApproval } = groupMyWork(myTickets);
  const completed = completedData?.tickets ?? [];

  const cardAction = (task: Ticket) => (
    <Link
      to='/dashboard/tickets/$ticketId'
      params={{ ticketId: String(task.id) }}
      className='block'
    >
      <Button size='sm' variant='outline' className='w-full'>
        {t('ticket.open')}
      </Button>
    </Link>
  );

  return (
    <div className='space-y-4 p-4'>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='in_progress'>{t('ticket.tabInProgress')}</TabsTrigger>
          <TabsTrigger value='available'>{t('ticket.tabAvailable')}</TabsTrigger>
          <TabsTrigger value='completed'>{t('ticket.tabCompleted')}</TabsTrigger>
        </TabsList>

        <TabsContent value='in_progress' className='space-y-5'>
          <Section title={t('ticket.activeAssignment')}>
            {active.length === 0 ? (
              <Empty label={t('ticket.nothingInProgress')} />
            ) : (
              <div className='space-y-2.5'>
                {active.map((task) => (
                  <TicketCard key={task.id} task={task} action={cardAction(task)} />
                ))}
              </div>
            )}
          </Section>
          <Section title={t('ticket.upNext')}>
            {upcoming.length === 0 ? (
              <Empty label={t('ticket.noAssignedTasks')} />
            ) : (
              <div className='space-y-2.5'>
                {upcoming.map((task) => (
                  <TicketCard key={task.id} task={task} action={cardAction(task)} />
                ))}
              </div>
            )}
          </Section>
          <Section title={t('ticket.pendingApproval')}>
            {pendingApproval.length === 0 ? (
              <Empty label={t('ticket.noPendingApproval')} />
            ) : (
              <div className='space-y-2.5'>
                {pendingApproval.map((task) => (
                  <TicketCard key={task.id} task={task} action={cardAction(task)} />
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value='available' className='space-y-5'>
          <AvailableTab />
        </TabsContent>

        <TabsContent value='completed' className='space-y-5'>
          <Section title={t('ticket.tabCompleted')}>
            {completed.length === 0 ? (
              <Empty label={t('ticket.noCompletedTickets')} />
            ) : (
              <div className='space-y-2.5'>
                {completed.map((task) => (
                  <TicketCard key={task.id} task={task} action={cardAction(task)} />
                ))}
              </div>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <Card className='dark:border-zinc-800/50 space-y-1 rounded-2xl p-4 dark:bg-zinc-900'>
        <p className='dark:text-zinc-400 text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
          {t('ticket.selfService')}
        </p>
        <Link
          to='/dashboard/leave'
          className='flex items-center gap-3 rounded-lg p-2 text-sm font-medium transition-colors hover:bg-muted'
        >
          <Icons.calendar className='size-5 text-muted-foreground' />
          {t('navigation.leave')}
        </Link>
      </Card>
    </div>
  );
}
