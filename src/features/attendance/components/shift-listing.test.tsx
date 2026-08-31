// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ShiftListing } from './shift-listing';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();

const { useQueryMock, useMutationMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => useQueryMock(),
    useMutation: (...args: Parameters<typeof actual.useMutation>) => {
      useMutationMock(...args);
      return actual.useMutation(...args);
    }
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const shiftsFixture = [
  {
    id: 1,
    name: 'Morning',
    start_time: '08:00',
    end_time: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    color: '#0ea5e9',
    late_tolerance_minutes: 5,
    status: 'active',
    used: false
  },
  {
    id: 2,
    name: 'Night Owl',
    start_time: '20:00',
    end_time: '05:00',
    break_start: null,
    break_end: null,
    color: '#64748b',
    late_tolerance_minutes: 5,
    status: 'inactive',
    used: true
  }
];

function setListingLoaded(overrides: Partial<(typeof shiftsFixture)[number]>[] = []) {
  useQueryMock.mockReturnValue({
    data: { success: true, shifts: [...shiftsFixture, ...overrides] },
    isLoading: false,
    isPending: false
  });
}

function renderListing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ShiftListing />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useQueryMock.mockReset();
  useMutationMock.mockReset();
});

describe('ShiftListing — rendering', () => {
  it('shows the loading state when the query is pending', () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true, isPending: true });
    renderListing();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('renders one row per shift with name, hours, break, and status', () => {
    setListingLoaded();
    renderListing();
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows.
    expect(rows).toHaveLength(3);
    const morningRow = rows.find((r) => r.textContent?.includes('Morning'));
    expect(morningRow).toBeTruthy();
    expect(morningRow?.textContent).toContain('08:00');
    expect(morningRow?.textContent).toContain('17:00');
    expect(morningRow?.textContent).toContain('12:00');
    expect(morningRow?.textContent).toContain('Active');

    const nightRow = rows.find((r) => r.textContent?.includes('Night Owl'));
    expect(nightRow).toBeTruthy();
    expect(nightRow?.textContent).toContain('Inactive');
    // Empty break cell renders the dash.
    expect(nightRow?.textContent).toContain('—');
  });
});

describe('ShiftListing — actions', () => {
  it('opens the Add dialog when the header button is clicked', () => {
    setListingLoaded();
    renderListing();
    fireEvent.click(screen.getByRole('button', { name: /Add Shift/i }));
    // SheetContent renders the title.
    expect(screen.getAllByText('New Shift').length).toBeGreaterThan(0);
  });

  it('renders one actions button per row (Radix menu interaction is verified by E2E)', () => {
    setListingLoaded();
    renderListing();
    const actionButtons = screen.getAllByRole('button', { name: /actions menu/i });
    expect(actionButtons).toHaveLength(2);
  });
});

describe('ShiftListing — delete confirm flow', () => {
  it('does not render the delete dialog body when no row is targeted (Radix skips the portal when open is false)', () => {
    setListingLoaded();
    renderListing();
    expect(screen.queryByText('Delete shift?')).toBeNull();
    expect(screen.queryByText('Deactivate shift?')).toBeNull();
  });
});
