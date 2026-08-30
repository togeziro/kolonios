import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { InitialChip } from '@/components/ui/initial-chip';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { submittedTicketsQueryOptions } from '@/features/tickets/api/queries';
import {
  reviewQueueQueryOptions,
  checklistPhotoUrlQueryOptions
} from '@/features/checklist/api/queries';
import { useUpdateChecklistStatus } from '@/features/checklist/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { Ticket } from '@/lib/domain/tickets';

export type ReviewQueueSubmission = {
  id: number;
  checklistId: number;
  technicianName: string;
  scheduleWindow: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  itemsResolved: number;
  itemsTotal: number;
  tasksLogged: number;
  note: string;
  photos: { id: number; key: string }[];
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  ticketId?: number;
};

const statusBadgeClass: Record<ReviewQueueSubmission['status'], string> = {
  pending: 'bg-blue-500/15 text-blue-500 dark:text-blue-400',
  approved: 'bg-green-500/15 text-green-500 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500 dark:text-red-400'
};

const statusLabelKey: Record<ReviewQueueSubmission['status'], string> = {
  pending: 'spvReview.statusPending',
  approved: 'spvReview.statusApproved',
  rejected: 'spvReview.statusRejected'
};

function CountStrip({
  pending,
  approved,
  rejected
}: {
  pending: number;
  approved: number;
  rejected: number;
}) {
  const { t } = useTranslation();
  const counts = [
    { label: t('spvReview.countPending'), value: pending },
    { label: t('spvReview.countApproved'), value: approved },
    { label: t('spvReview.countRejected'), value: rejected }
  ];
  return (
    <div className='dark:border-zinc-800/50 dark:bg-zinc-900 grid grid-cols-3 gap-2 rounded-2xl border p-3'>
      {counts.map((c) => (
        <div key={c.label} className='flex flex-col items-center gap-0.5'>
          <span className='dark:text-zinc-100 text-xl font-bold'>{c.value}</span>
          <span className='text-muted-foreground text-[11px] font-medium uppercase tracking-wider'>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChecklistPhoto({ photoKey, alt }: { photoKey: string; alt: string }) {
  const { data } = useQuery(checklistPhotoUrlQueryOptions(photoKey));
  const url = (data as { url?: string })?.url ?? '';
  if (!url) return null;
  return (
    <img src={url} alt={alt} className='dark:border-zinc-800 h-20 w-full rounded-lg object-cover' />
  );
}

function SubmissionCard({
  submission,
  onApprove,
  onReject,
  busy
}: {
  submission: ReviewQueueSubmission;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const decided = submission.status !== 'pending';
  const headerLink =
    submission.ticketId && !decided ? (
      <Link
        to='/dashboard/spv/review/$ticketId'
        params={{ ticketId: String(submission.ticketId) }}
        className='flex min-w-0 flex-1 items-center gap-3'
      >
        <InitialChip name={submission.technicianName} />
        <div className='min-w-0'>
          <p className='dark:text-zinc-100 truncate font-semibold'>{submission.technicianName}</p>
          <p className='text-muted-foreground truncate text-xs'>{submission.scheduleWindow}</p>
        </div>
      </Link>
    ) : (
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <InitialChip name={submission.technicianName} />
        <div className='min-w-0'>
          <p className='dark:text-zinc-100 truncate font-semibold'>{submission.technicianName}</p>
          <p className='text-muted-foreground truncate text-xs'>{submission.scheduleWindow}</p>
        </div>
      </div>
    );

  return (
    <div
      className={`dark:border-zinc-800/50 dark:bg-zinc-900 flex flex-col gap-3 rounded-2xl border p-4 ${
        decided ? 'opacity-60' : ''
      }`}
    >
      <div className='flex items-start justify-between gap-2'>
        {headerLink}
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass[submission.status]}`}
        >
          {t(statusLabelKey[submission.status])}
        </span>
      </div>

      {!decided && (
        <>
          <div className='dark:border-zinc-800/60 flex items-center justify-between rounded-xl border bg-card px-3 py-2 dark:bg-zinc-950/50'>
            <span className='text-muted-foreground text-[11px] font-semibold uppercase tracking-wider'>
              {t('spvReview.timeLog')}
            </span>
            <span className='dark:text-zinc-200 inline-flex items-center gap-1.5 text-sm font-medium'>
              <Icons.clock className='text-muted-foreground h-4 w-4' />
              {submission.clockInAt ?? '—'} {'–'} {submission.clockOutAt ?? '—'}
            </span>
          </div>

          <div className='dark:text-zinc-300 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
            <span className='inline-flex items-center gap-1.5'>
              <Icons.circleCheck className='h-4 w-4 text-green-500 dark:text-green-400' />
              {t('spvReview.checklistScore', {
                resolved: submission.itemsResolved,
                total: submission.itemsTotal
              })}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <Icons.forms className='text-muted-foreground h-4 w-4' />
              {t('spvReview.tasksLogged', { count: submission.tasksLogged })}
            </span>
          </div>

          {submission.note && (
            <blockquote className='dark:border-zinc-700/50 dark:text-zinc-400 border-l-2 pl-3 text-sm italic'>
              {'“'}
              {submission.note}
              {'”'}
            </blockquote>
          )}

          {submission.photos.length > 0 && (
            <div className='grid grid-cols-3 gap-2'>
              {submission.photos.map((photo) => (
                <ChecklistPhoto key={photo.id} photoKey={photo.key} alt={submission.note} />
              ))}
            </div>
          )}

          <div className='flex gap-2 pt-1'>
            <button
              type='button'
              disabled={busy}
              onClick={() => onReject()}
              className='dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 flex-1 rounded-full border py-2.5 text-sm font-semibold transition-colors disabled:opacity-50'
            >
              {t('spvReview.reject')}
            </button>
            <button
              type='button'
              disabled={busy}
              onClick={onApprove}
              className='flex-1 rounded-full bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50'
            >
              {t('spvReview.approve')}
            </button>
          </div>
        </>
      )}

      {decided && submission.status === 'approved' && (
        <p className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
          <Icons.checks className='h-4 w-4 text-green-500 dark:text-green-400' />
          {t('spvReview.reviewedBy', {
            name: submission.decidedBy ?? '',
            at: submission.decidedAt ?? ''
          })}
        </p>
      )}

      {submission.status === 'rejected' && submission.rejectionReason && (
        <div className='rounded-xl border border-dashed border-red-800/40 bg-red-950/30 px-3 py-2'>
          <p className='text-[11px] font-semibold uppercase tracking-wider text-red-400'>
            {t('spvReview.rejectionReason')}
          </p>
          <p className='mt-0.5 text-sm text-red-300'>{submission.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

export default function ReviewQueuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canReview = isAdmin || permissions.checklist?.approve === true;
  const canSeeTickets = isAdmin || permissions.spv_review?.view === true;
  const ticketsQuery = useQuery({ ...submittedTicketsQueryOptions(), enabled: canSeeTickets });
  const submittedTickets = ticketsQuery.data?.tickets ?? [];
  const reviewQuery = useQuery({ ...reviewQueueQueryOptions(), enabled: canReview });
  const updateStatus = useUpdateChecklistStatus();
  const [rejectTarget, setRejectTarget] = useState<ReviewQueueSubmission | null>(null);
  const [rejectedReason, setRejectedReason] = useState('');

  if (!canReview && !canSeeTickets) {
    return (
      <div className='mx-auto w-full max-w-lg px-4 py-8'>
        <p className='text-muted-foreground py-8 text-center text-sm'>{t('common.noAccess')}</p>
      </div>
    );
  }

  const submissions: ReviewQueueSubmission[] =
    reviewQuery.data && 'submissions' in reviewQuery.data
      ? (reviewQuery.data as { success: boolean; submissions: ReviewQueueSubmission[] }).submissions
      : [];
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigate({ to: '/dashboard' })}
              className='dark:hover:bg-zinc-900 -ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100'
            >
              <Icons.chevronLeft className='h-5 w-5' />
            </button>
            <div>
              <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
                {t('spvReview.title')}
              </h1>
              <p className='text-muted-foreground text-xs'>
                {t('spvReview.pendingSubtitle', { count: pendingCount })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className='mx-auto w-full max-w-lg flex-1 px-4 py-4'>
        <div className='flex flex-col gap-4'>
          {canReview && (
            <>
              <CountStrip
                pending={pendingCount}
                approved={approvedCount}
                rejected={rejectedCount}
              />
              {reviewQuery.isPending ? (
                <div className='flex justify-center py-6'>
                  <Icons.spinner className='text-muted-foreground h-5 w-5 animate-spin' />
                </div>
              ) : reviewQuery.isError ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('spvReview.loadFailed')}
                </p>
              ) : submissions.length === 0 ? (
                <p className='text-muted-foreground rounded-2xl border border-dashed py-6 text-center text-sm dark:border-zinc-800/60'>
                  {t('spvReview.emptyQueue')}
                </p>
              ) : (
                submissions.map((submission: ReviewQueueSubmission) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    busy={updateStatus.isPending}
                    onApprove={() =>
                      updateStatus.mutate({
                        checklistId: submission.checklistId,
                        status: 'approved'
                      })
                    }
                    onReject={(reason) => {
                      if (reason !== undefined) {
                        updateStatus.mutate({
                          checklistId: submission.checklistId,
                          status: 'rejected',
                          rejectedReason: reason
                        });
                        setRejectTarget(null);
                        setRejectedReason('');
                      } else {
                        setRejectTarget(submission);
                      }
                    }}
                  />
                ))
              )}
            </>
          )}

          {canSeeTickets && (
            <TicketReviewsSection tickets={submittedTickets} isLoading={ticketsQuery.isLoading} />
          )}
        </div>
      </main>
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectedReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('spvReview.rejectDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t('spvReview.rejectReasonPlaceholder')}
            value={rejectedReason}
            onChange={(e) => setRejectedReason(e.target.value)}
            className='min-h-24'
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={updateStatus.isPending}
              onClick={() => {
                if (!rejectTarget) return;
                updateStatus.mutate({
                  checklistId: rejectTarget.checklistId,
                  status: 'rejected',
                  rejectedReason: rejectedReason || undefined
                });
                setRejectTarget(null);
                setRejectedReason('');
              }}
            >
              {t('spvReview.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketReviewsSection({ tickets, isLoading }: { tickets: Ticket[]; isLoading: boolean }) {
  const { t } = useTranslation();

  return (
    <section className='space-y-3'>
      <div className='flex items-center justify-between'>
        <h2 className='dark:text-zinc-100 text-sm font-bold'>
          {t('spvReview.ticketReviewsTitle')}
        </h2>
        <span className='text-muted-foreground text-xs font-medium'>
          {t('spvReview.ticketReviewsCount', { count: tickets.length })}
        </span>
      </div>
      {isLoading ? (
        <div className='flex justify-center py-6'>
          <Icons.spinner className='text-muted-foreground h-5 w-5 animate-spin' />
        </div>
      ) : tickets.length === 0 ? (
        <p className='text-muted-foreground rounded-2xl border border-dashed py-6 text-center text-sm dark:border-zinc-800/60'>
          {t('spvReview.noSubmittedTickets')}
        </p>
      ) : (
        tickets.map((ticket) => <TicketReviewCard key={ticket.id} ticket={ticket} />)
      )}
    </section>
  );
}

function TicketReviewCard({ ticket }: { ticket: Ticket }) {
  const engineerName = ticket.takenByName ?? '—';

  return (
    <Link
      to='/dashboard/spv/review/$ticketId'
      params={{ ticketId: String(ticket.id) }}
      className='dark:border-zinc-800/50 dark:bg-zinc-900 flex flex-col gap-2 rounded-2xl border p-4'
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <InitialChip name={engineerName} />
          <div className='min-w-0'>
            <p className='dark:text-zinc-100 truncate font-semibold'>{ticket.title}</p>
            <p className='text-muted-foreground truncate text-xs'>
              {ticket.ticketCode ?? `#${ticket.id}`}
            </p>
          </div>
        </div>
        <Icons.chevronRight className='text-muted-foreground h-4 w-4 shrink-0' />
      </div>
    </Link>
  );
}
