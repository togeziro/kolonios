// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('@/lib/auth/auth-client', () => ({
  useSession: () => ({
    data: { user: { id: 'session-viewer', name: 'Viewer', email: 'viewer@example.com' } }
  })
}));

vi.mock('@/features/employees/api/career-events', () => ({
  careerTimelineQueryOptions: (employeeId: string) => ({
    queryKey: ['careerEvents', 'timeline', employeeId],
    queryFn: async () => ({})
  }),
  useDeleteCareerEvent: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  })
}));

vi.mock('./-career-event-dialog', () => ({
  CareerEventDialog: ({ category }: { category: string }) =>
    createElement('div', { 'data-testid': `career-event-dialog-${category}` }) as never
}));

import '@/i18n/config';
import { CareerTimelineSubTab } from './-career-timeline-tab';
import type { CareerTimelineEvent } from '@/features/employees/api/career-events';
import type { Employee } from '@/features/employees/api/types';

const fakeEmployee: Employee = {
  id: 'emp-1',
  employee_code: 'EMP-0001',
  full_name: 'Jane Doe',
  nickname: 'Jan',
  email: 'jane@example.com',
  phone: '+62-812-0000-0000',
  birth_place: 'Jakarta',
  birth_date: '1990-01-15',
  address: 'Jl. Sudirman 1',
  id_number: '3201234567890001',
  department_id: 1,
  designation_id: 2,
  is_internship: false,
  employment_status: 'active',
  join_date: '2024-01-01',
  leave_date: null,
  base_salary: 5_000_000,
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  department_name: 'Operation',
  designation_name: 'Field Engineer'
};

function makeEvent(
  overrides: Partial<CareerTimelineEvent> & Pick<CareerTimelineEvent, 'id'>
): CareerTimelineEvent {
  return {
    category: 'position',
    effective_date: '2026-01-01',
    notes: null,
    actor_user_id: null,
    from_designation_id: null,
    to_designation_id: 1,
    from_department_id: null,
    to_department_id: null,
    from_label: null,
    to_label: 'Field Services Engineer',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  cleanup();
  useQueryMock.mockReset();
});

function setQuery(data: unknown, state: Partial<{ isLoading: boolean; isError: boolean }> = {}) {
  useQueryMock.mockReturnValue({
    data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false
  });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(CareerTimelineSubTab, { employee: fakeEmployee })
    )
  );
}

describe('CareerTimelineSubTab — header', () => {
  it('renders the Length-of-Service header from the query data', () => {
    setQuery({
      lengthOfService: { years: 2, months: 3 },
      events: []
    });
    renderTab();
    expect(screen.getByText('Length of Service')).toBeTruthy();
    expect(screen.getByText('2 Year 3 Month')).toBeTruthy();
    expect(screen.getByText(/Time with the company/i)).toBeTruthy();
  });

  it('renders three enabled Change buttons (Division / Position / Work Status)', () => {
    setQuery({ lengthOfService: { years: 0, months: 0 }, events: [] });
    renderTab();
    expect(screen.getByRole('button', { name: 'Change Division' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Position' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change Work Status' })).toBeTruthy();
  });

  it('opens the CareerEventDialog when Change Position is clicked', () => {
    setQuery({ lengthOfService: { years: 0, months: 0 }, events: [] });
    renderTab();
    expect(screen.queryByTestId('career-event-dialog-position')).toBeNull();
    fireEvent.click(screen.getByTestId('career-action-position'));
    expect(screen.getByTestId('career-event-dialog-position')).toBeTruthy();
  });
});

describe('CareerTimelineSubTab — empty + loading + error states', () => {
  it('renders the empty-state message when there are no events', () => {
    setQuery({ lengthOfService: '1 Month', events: [] });
    renderTab();
    expect(screen.getByText(/No career events recorded yet/i)).toBeTruthy();
  });

  it('renders the loading state while the query is pending', () => {
    setQuery(undefined, { isLoading: true });
    renderTab();
    expect(screen.getByText(/Loading career history/i)).toBeTruthy();
  });
});

describe('CareerTimelineSubTab — event list ordering', () => {
  it('orders events by effective_date DESC with id DESC tie-break', () => {
    const events = [
      makeEvent({ id: 1, effective_date: '2026-01-10' }),
      makeEvent({ id: 2, effective_date: '2026-03-15' }),
      makeEvent({ id: 3, effective_date: '2026-02-20' })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const items = Array.from(container.querySelectorAll('[data-testid="career-event-item"]'));
    expect(items.map((el) => el.getAttribute('data-event-id'))).toEqual(['2', '3', '1']);
  });

  it('uses id DESC as the tie-breaker when two events share an effective_date', () => {
    const events = [
      makeEvent({ id: 1, effective_date: '2026-03-15' }),
      makeEvent({ id: 5, effective_date: '2026-03-15' }),
      makeEvent({ id: 2, effective_date: '2026-03-15' })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const items = Array.from(container.querySelectorAll('[data-testid="career-event-item"]'));
    expect(items.map((el) => el.getAttribute('data-event-id'))).toEqual(['5', '2', '1']);
  });
});

describe('CareerTimelineSubTab — event card rendering', () => {
  it('renders the category badge for each event using categoryColor/categoryIcon', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'position',
        effective_date: '2026-01-15',
        from_label: 'Helper',
        to_label: 'Engineer',
        to_designation_id: 2
      }),
      makeEvent({
        id: 2,
        category: 'division',
        effective_date: '2025-08-01',
        from_department_id: 1,
        to_department_id: 2,
        from_label: 'Operations',
        to_label: 'Field Services',
        from_designation_id: null,
        to_designation_id: null
      }),
      makeEvent({
        id: 3,
        category: 'start_work',
        effective_date: '2024-01-01',
        from_label: null,
        to_label: 'Field Services Engineer',
        to_designation_id: 1,
        from_designation_id: null,
        from_department_id: null,
        to_department_id: null
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const badges = Array.from(container.querySelectorAll('[data-testid="career-event-badge"]'));
    expect(badges).toHaveLength(3);
    const colors = badges.map((el) => el.getAttribute('data-category-color'));
    const icons = badges.map((el) => el.getAttribute('data-category-icon'));
    expect(colors).toEqual(['green', 'purple', 'indigo']);
    expect(icons).toEqual(['briefcase', 'building', 'play-circle']);
  });

  it('renders null from_label as "Not Set" in the from position', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'start_work',
        effective_date: '2024-01-01',
        from_label: null,
        to_label: 'Field Services Engineer',
        to_designation_id: 1
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    renderTab();
    expect(screen.getByText(/Not Set/)).toBeTruthy();
    expect(screen.getByText('Field Services Engineer')).toBeTruthy();
  });

  it('renders both from and to labels when both are set, with to_label bolded', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'position',
        effective_date: '2026-01-15',
        from_label: 'Helper Field Services Engineer',
        to_label: 'Field Services Engineer',
        to_designation_id: 2
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const item = container.querySelector('[data-testid="career-event-item"]');
    expect(item).toBeTruthy();
    expect(item!.textContent).toContain('Helper Field Services Engineer');
    expect(item!.textContent).toContain('Field Services Engineer');
    const bolded = item!.querySelector('[data-testid="career-event-to"]');
    expect(bolded).toBeTruthy();
    expect(bolded!.className).toMatch(/font-bold/);
  });
});

describe('CareerTimelineSubTab — recorded-at meta line', () => {
  it('hides the recorded-at meta line when effective_date equals created_at (date portion)', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'start_work',
        effective_date: '2026-01-15',
        // Same day — meta line should NOT render
        created_at: '2026-01-15T08:00:00.000Z',
        from_label: null,
        to_label: 'Field Services Engineer'
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    expect(container.querySelector('[data-testid="career-event-recorded-meta"]')).toBeNull();
  });

  it('shows the recorded-at meta line when effective_date differs from created_at', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'division',
        effective_date: '2026-01-15',
        created_at: '2026-01-20T08:00:00.000Z',
        from_label: 'Operations',
        to_label: 'Field Services',
        from_department_id: 1,
        to_department_id: 2
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const meta = container.querySelector('[data-testid="career-event-recorded-meta"]');
    expect(meta).toBeTruthy();
    expect(meta!.textContent).toMatch(/system/i);
  });
});

describe('CareerTimelineSubTab — expandable notes', () => {
  it('expands a note when the show-notes toggle is clicked', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'position',
        effective_date: '2026-01-15',
        from_label: 'Helper',
        to_label: 'Engineer',
        notes: 'Promoted after Q2 review',
        to_designation_id: 2
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    renderTab();
    const toggle = screen.getByRole('button', { name: /Show notes/i });
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.getByText('Promoted after Q2 review')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hide notes/i })).toBeTruthy();
  });

  it('omits the notes toggle when notes is null', () => {
    const events = [
      makeEvent({
        id: 1,
        category: 'start_work',
        effective_date: '2024-01-01',
        from_label: null,
        to_label: 'Field Services Engineer',
        notes: null
      })
    ];
    setQuery({ lengthOfService: { years: 0, months: 0 }, events });
    const { container } = renderTab();
    const item = container.querySelector('[data-testid="career-event-item"]');
    expect(within(item as HTMLElement).queryByRole('button', { name: /Show notes/i })).toBeNull();
  });
});
