// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { permsMock, stubActionMock, navigateMock } = vi.hoisted(() => ({
  permsMock: vi.fn(),
  stubActionMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => permsMock()
}));

vi.mock('@/lib/ui/stub-action', () => ({
  stubAction: stubActionMock
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
  return render(
    <I18nextProvider i18n={i18n}>
      <ReviewQueuePage />
    </I18nextProvider>
  );
}

describe('ReviewQueuePage', () => {
  beforeEach(() => {
    stubActionMock.mockClear();
    navigateMock.mockClear();
    permsMock.mockReturnValue({
      isAdmin: false,
      permissions: { checklist: { approve: true } }
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
});
