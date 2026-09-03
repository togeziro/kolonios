// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { queryMock, navigateMock, takeMutateAsyncMock, claimMutateAsyncMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  navigateMock: vi.fn(),
  takeMutateAsyncMock: vi.fn(),
  claimMutateAsyncMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options?.queryKey?.[1] ?? 'open')
  };
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
    queryKey: ['tickets', 'open', 'open'],
    queryFn: vi.fn()
  }),
  relayPoolQueryOptions: () => ({
    queryKey: ['tickets', 'relay', 'relay'],
    queryFn: vi.fn()
  })
}));

vi.mock('../api/hooks', () => ({
  useTakeTicket: () => ({
    mutateAsync: takeMutateAsyncMock,
    isPending: false
  }),
  useClaimLeg: () => ({
    mutateAsync: claimMutateAsyncMock,
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
    takenByName: null,
    takenAt: null,
    rating: null,
    reviewNote: null,
    reviewedBy: null,
    completedAt: null,
    createdByName: 'Admin',
    createdAt: new Date().toISOString(),
    legInfo: null,
    ...overrides
  };
}

function makeRelayItem(overrides: Partial<import('../api/types').RelayPoolItem> = {}) {
  return {
    ...makeTicket({ id: 2, ticketCode: 'T-002', title: 'Relay OLT', takenByName: 'Budi' }),
    claimableLeg: { legId: 5, legNumber: 2, name: 'Install', legsTotal: 2 },
    ...overrides
  };
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <JobsPage />
    </I18nextProvider>
  );
}

describe('JobsPage', () => {
  it('renders filter chips', () => {
    queryMock.mockImplementation(() => ({
      data: { tickets: [], unavailable: [], relay: [] },
      isLoading: false
    }));
    renderPage();
    expect(screen.getByText('All domains')).toBeTruthy();
    expect(screen.getByText('Field')).toBeTruthy();
    expect(screen.getByText('Backoffice')).toBeTruthy();
  });

  it('renders header with title', () => {
    queryMock.mockImplementation(() => ({
      data: { tickets: [], unavailable: [] },
      isLoading: false
    }));
    renderPage();
    expect(screen.getAllByText('Open Tickets').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no tickets', async () => {
    queryMock.mockImplementation(() => ({
      data: { tickets: [], unavailable: [] },
      isLoading: false
    }));
    renderPage();
    expect(screen.getByText(/no open tickets available/i)).toBeTruthy();
  });

  it('renders ticket cards with ticket data', () => {
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : { data: { tickets: [makeTicket()], unavailable: [] }, isLoading: false }
    );
    renderPage();
    expect(screen.getByText('T-001')).toBeTruthy();
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getAllByText('Jakarta Office').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Opened by/)).toBeTruthy();
    expect(screen.getByText('fiber')).toBeTruthy();
  });

  it('renders priority and domain badges', () => {
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : {
            data: {
              tickets: [makeTicket({ priority: 'medium', domain: 'backoffice' })],
              unavailable: []
            },
            isLoading: false
          }
    );
    renderPage();
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Backoffice').length).toBeGreaterThanOrEqual(2);
  });

  it('Take button triggers mutation and navigates on success', async () => {
    const ticket = makeTicket();
    takeMutateAsyncMock.mockResolvedValue({ success: true });
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : { data: { tickets: [ticket], unavailable: [] }, isLoading: false }
    );
    renderPage();
    const takeButton = screen.getByRole('button', { name: /take/i });
    fireEvent.click(takeButton);
    await waitFor(() => {
      expect(takeMutateAsyncMock).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/dashboard/en-route/$ticketId',
          params: { ticketId: '1' }
        })
      );
    });
  });

  it('shows loading spinner while loading', () => {
    queryMock.mockImplementation(() => ({ data: undefined, isLoading: true }));
    const { container } = renderPage();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders multiple ticket cards', () => {
    const tickets = [
      makeTicket({ id: 1, ticketCode: 'T-001', title: 'Install OLT' }),
      makeTicket({ id: 2, ticketCode: 'T-002', title: 'Repair fiber', priority: 'low' })
    ];
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : { data: { tickets, unavailable: [] }, isLoading: false }
    );
    renderPage();
    expect(screen.getByText('T-001')).toBeTruthy();
    expect(screen.getByText('T-002')).toBeTruthy();
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();
  });

  it('shows the Leg badge from real legInfo on multi-leg open tickets', () => {
    const multiLeg = makeTicket({ id: 7, ticketCode: 'T-007', title: 'Relay job' });
    const singleLeg = makeTicket({ id: 8, ticketCode: 'T-008', title: 'Solo job' });
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : {
            data: {
              tickets: [
                { ...multiLeg, legInfo: { legNumber: 1, legsTotal: 4 } },
                { ...singleLeg, legInfo: { legNumber: 1, legsTotal: 1 } }
              ],
              unavailable: []
            },
            isLoading: false
          }
    );
    renderPage();
    expect(screen.getByText('Leg 1 of 4')).toBeTruthy();
    expect(screen.queryByText('Leg 1 of 1')).toBeNull();
  });

  it('renders the Relay/Next Leg section with real pool data and holder', () => {
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [makeRelayItem()], unavailable: [] }, isLoading: false }
        : { data: { tickets: [], unavailable: [] }, isLoading: false }
    );
    renderPage();
    expect(screen.getByText('Relay / Next Leg')).toBeTruthy();
    expect(screen.getByText('Relay OLT')).toBeTruthy();
    expect(screen.getByText('Leg 2 of 2')).toBeTruthy();
    expect(screen.getByText(/Held by/)).toBeTruthy();
    expect(screen.getAllByText('Take Leg').length).toBeGreaterThanOrEqual(1);
  });

  it('renders unavailable relay tickets disabled with reasons', () => {
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? {
            data: {
              tickets: [],
              unavailable: [
                {
                  ...makeRelayItem({ id: 3, title: 'Skilled relay' }),
                  eligibilityReasons: ['Requires skill: Fiber Optic']
                }
              ]
            },
            isLoading: false
          }
        : { data: { tickets: [], unavailable: [] }, isLoading: false }
    );
    renderPage();
    expect(screen.getByText('Skilled relay')).toBeTruthy();
    expect(screen.getByText(/Requires skill: Fiber Optic/)).toBeTruthy();
  });

  it('Claim leg triggers the claim mutation and navigates to en-route on success', async () => {
    claimMutateAsyncMock.mockResolvedValue({ success: true, ticket: { id: 2 } });
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [makeRelayItem()], unavailable: [] }, isLoading: false }
        : { data: { tickets: [], unavailable: [] }, isLoading: false }
    );
    renderPage();
    const claimButtons = screen.getAllByRole('button', { name: /take leg/i });
    fireEvent.click(claimButtons[0]);
    await waitFor(() => {
      expect(claimMutateAsyncMock).toHaveBeenCalledWith(5);
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/dashboard/en-route/$ticketId',
          params: { ticketId: '2' }
        })
      );
    });
  });

  it('toggles a priority chip to filter the visible list and clears on second tap', () => {
    const tickets = [
      makeTicket({ id: 1, ticketCode: 'T-001', title: 'Install OLT', priority: 'high' }),
      makeTicket({ id: 2, ticketCode: 'T-002', title: 'Repair fiber', priority: 'medium' })
    ];
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : { data: { tickets, unavailable: [] }, isLoading: false }
    );
    renderPage();
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
    queryMock.mockImplementation((kind: string) =>
      kind === 'relay'
        ? { data: { tickets: [], unavailable: [] }, isLoading: false }
        : { data: { tickets, unavailable: [] }, isLoading: false }
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Bandung Site' }));
    expect(screen.getByText('Repair fiber')).toBeTruthy();
    expect(screen.queryByText('Install OLT')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bandung Site' }));
    expect(screen.getByText('Install OLT')).toBeTruthy();
    expect(screen.getByText('Repair fiber')).toBeTruthy();
  });
});
