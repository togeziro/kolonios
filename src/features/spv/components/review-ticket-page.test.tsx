// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { stubActionMock, navigateMock } = vi.hoisted(() => ({
  stubActionMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock('@/lib/ui/stub-action', () => ({
  stubAction: stubActionMock
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

import ReviewTicketPage from './review-ticket-page';

function renderPage(ticketId: number) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ReviewTicketPage ticketId={ticketId} />
    </I18nextProvider>
  );
}

describe('ReviewTicketPage', () => {
  beforeEach(() => {
    stubActionMock.mockClear();
    navigateMock.mockClear();
  });

  it.each([
    {
      id: 1042,
      code: '#T-1042',
      title: 'Instalasi FTTH — Budi Santoso',
      address: 'Jl. Merdeka No. 45, Jakarta Selatan',
      engineer: 'Dedi',
      material: 'Drop Cable 1 Core'
    },
    {
      id: 1087,
      code: '#T-1087',
      title: 'Maintenance Server Room B',
      address: 'Jl. Gatot Subroto No. 12, Jakarta Selatan',
      engineer: 'Rina',
      material: 'AC Filter 24 inch'
    }
  ])(
    'renders all sections from fixtures for ticket $id',
    ({ id, code, title, address, engineer, material }) => {
      renderPage(id);
      expect(screen.getByText(code)).toBeTruthy();
      expect(screen.getByText(title)).toBeTruthy();
      expect(screen.getByText(address)).toBeTruthy();
      expect(screen.getByText(/Requester/)).toBeTruthy();
      expect(screen.getByTestId('leg-progress-label').textContent).toContain('of');
      expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
      expect(screen.getByText(engineer)).toBeTruthy();
      expect(screen.getByText('Evidence Photos')).toBeTruthy();
      expect(screen.getByText('Materials Used')).toBeTruthy();
      expect(screen.getByText(material)).toBeTruthy();
      expect(screen.getByText(/Standard SOP Checklist · /)).toBeTruthy();
    }
  );

  it('shows a localized not-found state for unknown ids', () => {
    renderPage(9999);
    expect(screen.getByText('Ticket not found.')).toBeTruthy();
    expect(screen.queryByText('#T-1042')).toBeNull();
  });

  it('renders a filled leg progress track matching completed legs', () => {
    renderPage(1042);
    const bar = document.querySelector<HTMLDivElement>('[role="progressbar"] > div');
    expect(bar?.getAttribute('style')).toContain('width: 100%');
  });

  it('renders priority badge with tone classes', () => {
    renderPage(1042);
    const badge = document.querySelector('[data-priority="high"]');
    expect(badge?.className).toContain('bg-red-500/15');
  });

  it('back button navigates to the review queue', () => {
    renderPage(1042);
    fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard/spv/review' });
  });

  it('approve and reject fire the stub action (no existing transition function to wire)', () => {
    renderPage(1042);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(stubActionMock).toHaveBeenCalledTimes(2);
  });
});
