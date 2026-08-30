// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';

const { permsMock, navigateMock, updateMutateMock, submittedTicketsOptionsMock } = vi.hoisted(
  () => ({
    permsMock: vi.fn(),
    navigateMock: vi.fn(),
    updateMutateMock: vi.fn(),
    submittedTicketsOptionsMock: vi.fn()
  })
);

const reviewSubmissionsFixture = [
  {
    id: 101,
    checklistId: 101,
    technicianName: 'Alex Kim',
    scheduleWindow: 'Wed, Aug 12 · 08:00 - 17:00',
    clockInAt: '08:05',
    clockOutAt: '16:48',
    itemsResolved: 6,
    itemsTotal: 6,
    tasksLogged: 2,
    note: 'Installed fiber drop at Jl. Melati. Signal strength tested OK.',
    photos: [
      { id: 1, key: '/fixtures/checklist-drop-cable.jpg' },
      { id: 2, key: '/fixtures/checklist-odp-final.jpg' }
    ],
    status: 'pending' as const,
    ticketId: 1042
  },
  {
    id: 102,
    checklistId: 102,
    technicianName: 'Rina Wijaya',
    scheduleWindow: 'Wed, Aug 12 · 09:00 - 18:00',
    clockInAt: '08:55',
    clockOutAt: '18:15',
    itemsResolved: 4,
    itemsTotal: 4,
    tasksLogged: 1,
    note: 'Routine maintenance at server room B. AC unit filters replaced.',
    photos: [{ id: 3, key: '/fixtures/checklist-server-room.jpg' }],
    status: 'pending' as const,
    ticketId: 1087
  },
  {
    id: 103,
    checklistId: 103,
    technicianName: 'Joko Prasetyo',
    scheduleWindow: 'Tue, Aug 11 · 08:00 - 17:00',
    clockInAt: '07:58',
    clockOutAt: '17:02',
    itemsResolved: 6,
    itemsTotal: 6,
    tasksLogged: 3,
    note: 'Full route inspection completed, no anomalies found.',
    photos: [],
    status: 'approved' as const,
    decidedBy: 'SPV_01',
    decidedAt: 'Aug 11, 18:30'
  },
  {
    id: 104,
    checklistId: 104,
    technicianName: 'Sari Indah',
    scheduleWindow: 'Mon, Aug 10 · 07:00 - 16:00',
    clockInAt: '07:12',
    clockOutAt: null,
    itemsResolved: 3,
    itemsTotal: 6,
    tasksLogged: 1,
    note: 'Rain stopped work after lunch.',
    photos: [],
    status: 'rejected' as const,
    rejectionReason: 'Missing photo evidence for task #4092.'
  }
];

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => permsMock()
}));

vi.mock('@/features/tickets/api/queries', () => ({
  submittedTicketsQueryOptions: (...args: unknown[]) => submittedTicketsOptionsMock(...args)
}));

vi.mock('@/features/checklist/api/queries', () => ({
  reviewQueueQueryOptions: () => ({
    queryKey: ['checklist', 'reviewQueue'],
    queryFn: () => Promise.resolve({ success: true, submissions: reviewSubmissionsFixture })
  }),
  checklistPhotoUrlQueryOptions: (key: string) => ({
    queryKey: ['checklist', 'photo', key],
    queryFn: () => Promise.resolve({ url: key })
  })
}));

vi.mock('@/features/checklist/api/hooks', () => ({
  useUpdateChecklistStatus: () => ({
    mutate: updateMutateMock,
    isPending: false
  })
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
    }) => (
      <a href={params?.ticketId ? `${to.replace('$ticketId', params.ticketId)}` : to}>{children}</a>
    ),
    useNavigate: () => navigateMock
  };
});

import ReviewQueuePage from './review-queue-page';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ReviewQueuePage />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe('ReviewQueuePage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    updateMutateMock.mockClear();
    submittedTicketsOptionsMock.mockReturnValue({
      queryKey: ['tickets', 'submitted'],
      queryFn: () => Promise.resolve({ success: true, tickets: [] })
    });
    permsMock.mockReturnValue({
      isAdmin: false,
      permissions: {
        checklist: { approve: true },
        spv_review: { view: true, edit: true }
      }
    });
  });

  it('renders the count strip derived from live query', async () => {
    renderPage();
    await screen.findByText('Alex Kim');
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('renders pending cards with day context from live data', async () => {
    renderPage();
    await screen.findByText('Alex Kim');
    expect(screen.getByText('Rina Wijaya')).toBeTruthy();
    expect(screen.getByText('Wed, Aug 12 · 08:00 - 17:00')).toBeTruthy();
    expect(screen.getByText(/Installed fiber drop/)).toBeTruthy();
    expect(screen.getByText('Checklist 6/6 OK')).toBeTruthy();
    expect(screen.getByText('2 tasks logged')).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector('img[src="/fixtures/checklist-drop-cable.jpg"]')).toBeTruthy()
    );
  });

  it('renders decided cards dimmed with badge and rejection reason', async () => {
    renderPage();
    await screen.findByText('Joko Prasetyo');
    const approvedCard = screen.getByText('Joko Prasetyo').closest('.opacity-60');
    expect(approvedCard).toBeTruthy();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText(/Missing photo evidence for task #4092/)).toBeTruthy();
  });

  it('pending cards link to the review ticket detail', async () => {
    renderPage();
    await screen.findByText('Alex Kim');
    const link = document.querySelector<HTMLAnchorElement>('a[href="/dashboard/spv/review/1042"]');
    expect(link).toBeTruthy();
  });

  it('approve and reject buttons call update mutation', async () => {
    renderPage();
    await screen.findByText('Alex Kim');
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    expect(updateMutateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    // reject opens dialog; confirm within dialog triggers mutate with rejected
    const dialogReject = await screen.findByRole('dialog');
    expect(dialogReject).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reject', hidden: false }));
    // The dialog's reject button is also named Reject; ensure at least one rejected call
    await waitFor(() =>
      expect(updateMutateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }))
    );
  });

  it('hides the queue behind a no-access state without checklist.approve', async () => {
    permsMock.mockReturnValue({ isAdmin: false, permissions: {} });
    renderPage();
    expect(await screen.findByText(/You do not have access to this page/i)).toBeTruthy();
    expect(screen.queryByText('Alex Kim')).toBeNull();
  });

  it('shows the Ticket Reviews section with submitted tickets and links to detail', async () => {
    submittedTicketsOptionsMock.mockReturnValue({
      queryKey: ['tickets', 'submitted'],
      queryFn: () =>
        Promise.resolve({
          success: true,
          tickets: [
            {
              id: 77,
              ticketCode: 'T-77',
              title: 'Ticket awaiting review',
              takenByName: 'Dedi',
              status: 'submitted',
              priority: 'high'
            }
          ]
        })
    });
    renderPage();
    await screen.findByText('Ticket awaiting review');
    const link = document.querySelector<HTMLAnchorElement>('a[href="/dashboard/spv/review/77"]');
    expect(link).toBeTruthy();
  });

  it('shows the empty state when no tickets are awaiting review', async () => {
    renderPage();
    await screen.findByText('No tickets awaiting review');
  });

  it('hides the Ticket Reviews section without spv_review.view but keeps checklist cards', async () => {
    permsMock.mockReturnValue({
      isAdmin: false,
      permissions: { checklist: { approve: true } }
    });
    renderPage();
    await screen.findByText('Alex Kim');
    expect(screen.queryByText('Ticket Reviews')).toBeNull();
  });
});
