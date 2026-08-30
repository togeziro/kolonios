// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import type { TicketDetail } from '@/lib/domain/tickets';

const { navigateMock, reviewTicketFnMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  reviewTicketFnMock: vi.fn()
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('@/features/tickets/api/service', () => ({
  reviewTicketFn: reviewTicketFnMock
}));

const { ticketDetailQueryOptionsMock } = vi.hoisted(() => ({
  ticketDetailQueryOptionsMock: vi.fn()
}));

vi.mock('@/features/tickets/api/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tickets/api/queries')>();
  return {
    ...actual,
    ticketDetailQueryOptions: ticketDetailQueryOptionsMock
  };
});

import ReviewTicketPage from './review-ticket-page';

function makeDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 55,
    ticketCode: 'T-55',
    title: 'Maintenance Server Room B',
    description: '',
    channel: 'field',
    customer: {
      id: 'c1',
      name: 'Sales Hub',
      phone: null,
      address: 'Jl. Merdeka No. 45',
      latitude: 0,
      longitude: 0
    },
    assetName: '',
    taskType: 'maintenance',
    domain: 'backoffice',
    status: 'submitted',
    priority: 'medium',
    location: { id: 1, name: 'Depot' },
    dueAt: null,
    estimatedMinutes: null,
    requiredSkills: [],
    assignedTo: null,
    takenBy: 'tech-1',
    takenByName: 'Dedi Setiawan',
    takenAt: null,
    rating: null,
    reviewNote: null,
    reviewedBy: null,
    completedAt: null,
    createdByName: 'Ops',
    createdAt: '2026-08-01T00:00:00Z',
    legs: [
      {
        id: 1,
        legNumber: 1,
        name: 'Survey',
        description: '',
        status: 'completed',
        assigneeId: null,
        takenAt: null,
        completedAt: null,
        notes: ''
      },
      {
        id: 2,
        legNumber: 2,
        name: 'Install',
        description: '',
        status: 'submitted',
        assigneeId: null,
        takenAt: null,
        completedAt: null,
        notes: 'AC filter replaced, temp 22C'
      }
    ],
    materials: [
      {
        id: 1,
        legId: 2,
        legName: 'Install',
        materialName: 'AC Filter',
        qty: 1,
        unit: 'pcs',
        source: 'van',
        barcode: ''
      }
    ],
    photos: [{ id: 1, legId: 2, fileUrl: 'tickets/1/9.jpg', caption: 'AC filter' }],
    worklog: [
      {
        id: 1,
        legId: 2,
        kind: 'note',
        body: 'Work done, signal OK',
        createdAt: '2026-08-01T00:00:00Z',
        createdBy: 'tech-1'
      }
    ],
    requesterId: null
  };
}

function renderPage(ticketId: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ReviewTicketPage ticketId={ticketId} />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

describe('ReviewTicketPage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    reviewTicketFnMock.mockReset();
    ticketDetailQueryOptionsMock.mockReset();
    ticketDetailQueryOptionsMock.mockImplementation((ticketId: number) => ({
      queryKey: ['tickets', 'detail', ticketId],
      queryFn: async () => ({ success: true, ticket: makeDetail({ id: ticketId }) })
    }));
  });

  it('renders all sections from the real ticket detail', async () => {
    renderPage(55);
    await waitFor(() => expect(screen.getByText('#T-55')).toBeTruthy());
    expect(screen.getByText('Maintenance Server Room B')).toBeTruthy();
    expect(screen.getByText('Jl. Merdeka No. 45')).toBeTruthy();
    expect(screen.getByText(/Requester/)).toBeTruthy();
    expect(screen.getByTestId('leg-progress-label').textContent).toContain('of');
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.getByText('Dedi Setiawan')).toBeTruthy();
    expect(screen.getByText('Evidence Photos')).toBeTruthy();
    expect(screen.getByText('Materials Used')).toBeTruthy();
    expect(screen.getByText('AC Filter')).toBeTruthy();
  });

  it('shows a localized not-found state when the ticket is missing', async () => {
    ticketDetailQueryOptionsMock.mockImplementation((ticketId: number) => ({
      queryKey: ['tickets', 'detail', ticketId],
      queryFn: async () => ({ success: false })
    }));
    renderPage(9999);
    await waitFor(() => expect(screen.getByText('Ticket not found.')).toBeTruthy());
  });

  it('renders the leg progress bar from real legs', async () => {
    renderPage(55);
    await waitFor(() => expect(document.querySelector('[role="progressbar"]')).toBeTruthy());
    const bar = document.querySelector<HTMLDivElement>('[role="progressbar"] > div');
    expect(bar?.getAttribute('style')).toContain('width: 100%');
  });

  it('renders the priority badge with tone classes', async () => {
    renderPage(55);
    await waitFor(() => expect(document.querySelector('[data-priority="medium"]')).toBeTruthy());
    const badge = document.querySelector('[data-priority="medium"]');
    expect(badge?.className).toContain('bg-amber-500/15');
  });

  it('back button navigates to the review queue', async () => {
    renderPage(55);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to queue' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard/spv/review' });
  });

  it('approve fires reviewTicketFn with decision approved, then navigates back to the queue', async () => {
    reviewTicketFnMock.mockResolvedValue({ success: true, message: 'Ticket approved' });
    renderPage(55);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(reviewTicketFnMock).toHaveBeenCalledWith({
        data: { ticketId: 55, decision: 'approved' }
      })
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard/spv/review' }));
  });

  it('reject fires reviewTicketFn with decision rejected', async () => {
    reviewTicketFnMock.mockResolvedValue({ success: true, message: 'Ticket rejected' });
    renderPage(55);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(reviewTicketFnMock).toHaveBeenCalledWith({
        data: { ticketId: 55, decision: 'rejected' }
      })
    );
  });

  it('shows an error path instead of navigating when the server declines the review', async () => {
    reviewTicketFnMock.mockResolvedValue({
      success: false,
      message: 'Ticket is no longer awaiting review'
    });
    renderPage(55);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(reviewTicketFnMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).not.toHaveBeenCalled());
  });
});
