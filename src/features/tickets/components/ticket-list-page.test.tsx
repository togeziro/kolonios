// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { queryMock, navigateMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => queryMock()
  };
});

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useSearch: () => ({}),
    useNavigate: () => navigateMock
  };
});

vi.mock('@/routes/dashboard/tickets/index', () => ({
  Route: { id: 'tickets-index' }
}));

vi.mock('../api/queries', () => ({
  listTicketsQueryOptions: () => ({
    queryKey: ['tickets', 'list'],
    queryFn: vi.fn()
  })
}));

import TicketListPage from './ticket-list-page';

// Regression: ISSUE-001 — ticket filter tabs rendered raw i18n keys
describe('TicketListPage status tabs', () => {
  it('renders translated labels without raw keys or uninterpolated placeholders', () => {
    queryMock.mockReturnValue({ data: { tickets: [] }, isLoading: false });
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TicketListPage />
      </I18nextProvider>
    );
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Submitted')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).not.toContain('ticket.submitted');
    expect(text).not.toContain('inProgressCount');
    expect(text).not.toContain('{{count}}');
  });
});
