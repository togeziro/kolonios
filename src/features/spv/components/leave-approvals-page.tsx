import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { InitialChip } from '@/components/ui/initial-chip';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { stubAction } from '@/lib/ui/stub-action';
import { formatDate } from '@/lib/format';
import { LEAVE_REQUESTS, type LeaveRequestFixture } from './leave-approvals-fixtures';

const typeLabelKey: Record<LeaveRequestFixture['type'], string> = {
  annual: 'leaveApprovals.typeAnnual',
  sick: 'leaveApprovals.typeSick',
  personal: 'leaveApprovals.typePersonal',
  emergency: 'leaveApprovals.typeEmergency',
  maternity: 'leaveApprovals.typeMaternity',
  paternity: 'leaveApprovals.typePaternity'
};

type TabStatus = LeaveRequestFixture['status'];

const tabs: { value: TabStatus; labelKey: string; activeClass: string }[] = [
  {
    value: 'pending',
    labelKey: 'leaveApprovals.tabPending',
    activeClass: 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
  },
  {
    value: 'approved',
    labelKey: 'leaveApprovals.tabApproved',
    activeClass: 'bg-green-500/15 text-green-500 dark:text-green-400'
  },
  {
    value: 'rejected',
    labelKey: 'leaveApprovals.tabRejected',
    activeClass: 'bg-red-500/15 text-red-500 dark:text-red-400'
  }
];

function isThisMonth(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function LeaveCard({ request }: { request: LeaveRequestFixture }) {
  const { t } = useTranslation();
  const pending = request.status === 'pending';

  return (
    <div className='dark:border-zinc-800/50 dark:bg-zinc-900 flex flex-col gap-3 rounded-2xl border p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-3'>
          <InitialChip name={request.requesterName} />
          <div className='min-w-0'>
            <p className='dark:text-zinc-100 truncate font-semibold'>{request.requesterName}</p>
            <p className='text-muted-foreground truncate text-xs'>
              {request.requesterRole} {'·'} {request.requesterDepartment}
            </p>
          </div>
        </div>
        {!pending && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              tabs.find((tab) => tab.value === request.status)?.activeClass ?? ''
            }`}
          >
            {t(tabs.find((tab) => tab.value === request.status)?.labelKey ?? '')}
          </span>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <span className='dark:bg-zinc-800 dark:text-zinc-300 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-700'>
          {t(typeLabelKey[request.type])}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            request.paid
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}
        >
          {t(request.paid ? 'leaveApprovals.paid' : 'leaveApprovals.unpaid')}
        </span>
        <span className='bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold'>
          {t('leaveApprovals.durationDays', { count: request.durationDays })}
        </span>
      </div>

      <p className='dark:text-zinc-300 flex items-center gap-2 text-sm'>
        <Icons.calendar className='text-muted-foreground h-4 w-4' />
        {formatDate(request.startDate)} {'–'} {formatDate(request.endDate)}
      </p>
      {request.reason && (
        <blockquote className='dark:border-zinc-700/50 dark:text-zinc-400 border-l-2 pl-3 text-sm italic'>
          {'“'}
          {request.reason}
          {'”'}
        </blockquote>
      )}

      {!request.paid && (
        <p className='inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400'>
          <Icons.warning className='h-4 w-4 shrink-0' />
          {t('leaveApprovals.unpaidHint')}
        </p>
      )}

      {pending && (
        <div className='flex gap-2 pt-1'>
          <button
            type='button'
            onClick={() => stubAction(t('leaveApprovals.reject'))}
            className='dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 flex-1 rounded-full border py-2.5 text-sm font-semibold transition-colors'
          >
            {t('leaveApprovals.reject')}
          </button>
          <button
            type='button'
            onClick={() => stubAction(t('leaveApprovals.approve'))}
            className='flex-1 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-500'
          >
            {t('leaveApprovals.approve')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LeaveApprovalsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canView = isAdmin || permissions.spv_review?.view === true;
  const [tab, setTab] = useState<TabStatus>('pending');

  if (!canView) {
    return (
      <div className='mx-auto w-full max-w-lg px-4 py-8'>
        <p className='text-muted-foreground py-8 text-center text-sm'>{t('common.noAccess')}</p>
      </div>
    );
  }

  const requests = LEAVE_REQUESTS;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const thisMonthCount = requests.filter((r) => isThisMonth(r.startDate)).length;
  const visible = requests.filter((r) => r.status === tab);

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='mx-auto w-full max-w-lg px-4 py-3'>
          <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
            {t('leaveApprovals.title')}
          </h1>
        </div>
        <div className='mx-auto flex w-full max-w-lg gap-2 px-4 pb-3'>
          <span className='dark:border-zinc-800/60 dark:bg-zinc-900 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold'>
            <Icons.clock className='h-4 w-4 text-blue-500 dark:text-blue-400' />
            {t('leaveApprovals.chipsPending', { count: pendingCount })}
          </span>
          <span className='dark:border-zinc-800/60 dark:bg-zinc-900 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold'>
            <Icons.calendar className='text-muted-foreground h-4 w-4' />
            {t('leaveApprovals.chipsThisMonth', { count: thisMonthCount })}
          </span>
        </div>
        <div className='no-scrollbar mx-auto flex w-full max-w-lg gap-2 overflow-x-auto px-4 pb-3'>
          {tabs.map((item) => (
            <button
              key={item.value}
              type='button'
              onClick={() => setTab(item.value)}
              data-active={tab === item.value}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                tab === item.value
                  ? item.activeClass
                  : 'dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 border border-zinc-300 text-zinc-500'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </header>

      <main className='mx-auto w-full max-w-lg flex-1 px-4 py-4'>
        <div className='flex flex-col gap-4'>
          {visible.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('leaveApprovals.emptyTab')}
            </p>
          ) : (
            visible.map((request) => <LeaveCard key={request.id} request={request} />)
          )}
        </div>
      </main>
    </div>
  );
}
