// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { queryMock, navigateMock, takeMutateAsyncMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  navigateMock: vi.fn(),
  takeMutateAsyncMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => queryMock() };
});

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useSearch: () => ({ domain: undefined }),
    useNavigate: () => navigateMock
  };
});

vi.mock('../api/queries', () => ({
  openTicketsQueryOptions: () => ({
    queryKey: ['tickets', 'open'],
    queryFn: vi.fn()
  })
}));

vi.mock('../api/hooks', () => ({
  useTakeTicket: () => ({
    mutateAsync: takeMutateAsyncMock,
    isPending: false
  })
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => ({
    isAdmin: false,
    permissions: { tickets: { add: true } }
  })
}));

import JobsPage from './jobs-page';

function makeTicket(overrides: Partial<import('../api/types').Ticket> = {}) {
  return {
    id: 1,
    ticketCode: 'T-001',
    title: 'Install OLT',
    description: '',
    channel: 'field',
    customer: null,
    assetName: '',
    taskType: 'installation',
    domain: 'field' as const,
    status: 'open' as const,
    priority: 'high' as const,
    location: { id: 1, name: 'Jakarta Office' },
    dueAt: null,
    estimatedMinutes: null,
    requiredSkills: ['fiber'],
    assignedTo: null,
    takenBy: null,
    takenAt: null,
    rating: null,
    reviewNote: null,
    reviewedBy: null,
    completedAt: null,
    createdByName: 'Admin',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe('JobsPage', () => {
  it('renders filter chips', () => {
    queryMock.mockReturnValue({ data: { tickets: [] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('All domains')).toBeTruthy();
    expect(screen.getByText('Field')).toBeTruthy();
    expect(screen.getByText('Backoffice')).toBeTruthy();
  });

  it('renders header with title', () => {
    queryMock.mockReturnValue({ data: { tickets: [] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('Open Tickets')).toBeTruthy();
  });

  it('shows empty state when no tickets', async () => {
    queryMock.mockReturnValue({ data: { tickets: [] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText(/no open tickets available/i)).toBeTruthy();
  });

  it('renders ticket cards with ticket data', () => {
    const ticket = makeTicket();
    queryMock.mockReturnValue({ data: { tickets: [ticket] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('T-001')).toBeTruthy();
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getAllByText('Jakarta Office').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Opened by/)).toBeTruthy();
    expect(screen.getByText('fiber')).toBeTruthy();
  });

  it('renders priority and domain badges', () => {
    const ticket = makeTicket({ priority: 'medium', domain: 'backoffice' });
    queryMock.mockReturnValue({ data: { tickets: [ticket] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Backoffice').length).toBeGreaterThanOrEqual(2);
  });

  it('Take button triggers mutation and navigates on success', async () => {
    const ticket = makeTicket();
    takeMutateAsyncMock.mockResolvedValue({ success: true });
    queryMock.mockReturnValue({ data: { tickets: [ticket] }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    const takeButton = screen.getByRole('button', { name: /take/i });
    fireEvent.click(takeButton);
    await waitFor(() => {
      expect(takeMutateAsyncMock).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/dashboard/tickets/$ticketId',
          params: { ticketId: '1' }
        })
      );
    });
  });

  it('shows loading spinner while loading', () => {
    queryMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders multiple ticket cards', () => {
    const tickets = [
      makeTicket({ id: 1, ticketCode: 'T-001', title: 'Install OLT' }),
      makeTicket({ id: 2, ticketCode: 'T-002', title: 'Repair fiber', priority: 'low' })
    ];
    queryMock.mockReturnValue({ data: { tickets }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('T-001')).toBeTruthy();
    expect(screen.getByText('T-002')).toBeTruthy();
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();
  });

  it('shows Leg badge for multi-leg relay entries and none for single-leg or missing entries', () => {
    const multiLeg = makeTicket({ id: 7, ticketCode: 'T-007', title: 'Relay job' });
    const singleLeg = makeTicket({ id: 8, ticketCode: 'T-008', title: 'Solo job' });
    const noEntry = makeTicket({ id: 9, ticketCode: 'T-009', title: 'Plain job' });
    queryMock.mockReturnValue({
      data: { tickets: [multiLeg, singleLeg, noEntry] },
      isLoading: false
    });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage
          relayMap={{ 7: { legNumber: 2, legsTotal: 4 }, 8: { legNumber: 1, legsTotal: 1 } }}
        />
      </I18nextProvider>
    );
    expect(screen.getByText('Leg 2 of 4')).toBeTruthy();
    expect(screen.queryByText('Leg 1 of 1')).toBeNull();
    expect(screen.queryByText(/^Leg \d+ of \d+$/)?.textContent).toBe('Leg 2 of 4');
  });

  it('shows Leg badge from the fixture module for matching ticket ids', () => {
    queryMock.mockReturnValue({
      data: { tickets: [makeTicket({ id: 4101, ticketCode: 'T-101', title: 'Fixture relay' })] },
      isLoading: false
    });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('Leg 1 of 3')).toBeTruthy();
  });

  it('toggles a priority chip to filter the visible list and clears on second tap', () => {
    const tickets = [
      makeTicket({ id: 1, ticketCode: 'T-001', title: 'Install OLT', priority: 'high' }),
      makeTicket({ id: 2, ticketCode: 'T-002', title: 'Repair fiber', priority: 'medium' })
    ];
    queryMock.mockReturnValue({ data: { tickets }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^High$/ }));
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.queryByText('Repair fiber')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^High$/ }));
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();
  });

  it('toggles a location chip derived from loaded tickets to filter the visible list', () => {
    const tickets = [
      makeTicket({
        id: 1,
        ticketCode: 'T-001',
        title: 'Install OLT',
        location: { id: 1, name: 'Jakarta Office' }
      }),
      makeTicket({
        id: 2,
        ticketCode: 'T-002',
        title: 'Repair fiber',
        location: { id: 2, name: 'Bandung Site' }
      })
    ];
    queryMock.mockReturnValue({ data: { tickets }, isLoading: false });
    render(
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bandung Site' }));
    expect(screen.getByText('Repair fiber')).toBeTruthy();
    expect(screen.queryByText('Install OLT')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bandung Site' }));
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();
  });
});
