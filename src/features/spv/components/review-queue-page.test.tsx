// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';

const { permsMock, stubActionMock, navigateMock, submittedTicketsFnMock } = vi.hoisted(() => ({
  permsMock: vi.fn(),
  stubActionMock: vi.fn(),
  navigateMock: vi.fn(),
  submittedTicketsFnMock: vi.fn()
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => permsMock()
}));

vi.mock('@/lib/ui/stub-action', () => ({
  stubAction: stubActionMock
}));

vi.mock('@/features/tickets/api/service', () => ({
  listSubmittedTicketsFn: submittedTicketsFnMock
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
    stubActionMock.mockClear();
    navigateMock.mockClear();
    submittedTicketsFnMock.mockReset();
    submittedTicketsFnMock.mockResolvedValue({ success: true, tickets: [] });
    permsMock.mockReturnValue({
      isAdmin: false,
      permissions: {
        checklist: { approve: true },
        spv_review: { view: true, edit: true }
      }
    });
  });

  it('renders the count strip derived from fixtures', () => {
    renderPage();
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('renders pending cards with day context from fixtures', () => {
    renderPage();
    expect(screen.getByText('Alex Kim')).toBeTruthy();
    expect(screen.getByText('Rina Wijaya')).toBeTruthy();
    expect(screen.getByText('Wed, Aug 12 · 08:00 - 17:00')).toBeTruthy();
    expect(screen.getByText(/Installed fiber drop/)).toBeTruthy();
    expect(screen.getByText('Checklist 6/6 OK')).toBeTruthy();
    expect(screen.getByText('2 tasks logged')).toBeTruthy();
    expect(document.querySelector('img[src="/fixtures/checklist-drop-cable.jpg"]')).toBeTruthy();
  });

  it('renders decided cards dimmed with badge and rejection reason', () => {
    renderPage();
    const approvedCard = screen.getByText('Joko Prasetyo').closest('.opacity-60');
    expect(approvedCard).toBeTruthy();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.getByText(/Missing photo evidence for task #4092/)).toBeTruthy();
  });

  it('pending cards link to the review ticket detail', () => {
    renderPage();
    const link = document.querySelector<HTMLAnchorElement>('a[href="/dashboard/spv/review/1042"]');
    expect(link).toBeTruthy();
  });

  it('approve and reject buttons fire the stub action', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    expect(stubActionMock).toHaveBeenCalledTimes(2);
  });

  it('hides the queue behind a no-access state without checklist.approve', () => {
    permsMock.mockReturnValue({ isAdmin: false, permissions: {} });
    renderPage();
    expect(screen.getByText(/You do not have access to this page/i)).toBeTruthy();
    expect(screen.queryByText('Alex Kim')).toBeNull();
  });

  it('shows the Ticket Reviews section with submitted tickets and links to detail', async () => {
    submittedTicketsFnMock.mockResolvedValue({
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
    expect(submittedTicketsFnMock).not.toHaveBeenCalled();
  });
});
