// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { submitMock, detailMock, navigateMock } = vi.hoisted(() => ({
  submitMock: vi.fn(),
  detailMock: vi.fn(),
  navigateMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => ({ data: detailMock(), isLoading: false }) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock
}));

vi.mock('../api/hooks', () => ({
  useSubmitWorkSession: () => ({ mutate: submitMock, isPending: false }),
  useSubmitHandoffNote: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('./elapsed-timer', () => ({
  default: () => <div>elapsed-timer</div>,
  formatElapsed: (ms: number) => String(ms)
}));

vi.mock('./work-log', () => ({
  default: ({ onChange }: { onChange: (entries: unknown[]) => void }) => (
    <button type='button' onClick={() => onChange([{ kind: 'note', body: 'logged' }])}>
      add-log
    </button>
  )
}));

vi.mock('./materials-used', () => ({
  default: () => <div>materials</div>
}));

vi.mock('./completion-photos', () => ({
  default: ({ onChange }: { onChange: (photos: string[]) => void }) => (
    <button type='button' onClick={() => onChange(['photo-key'])}>
      add-photo
    </button>
  )
}));

import WorkSessionPage from './work-session-page';

const BASE_TICKET = {
  id: 7,
  ticketCode: 'T-7',
  title: 'Field install',
  status: 'in_progress',
  takenAt: '2026-08-16T07:00:00Z',
  priority: 'high',
  taskType: 'installation',
  domain: 'field',
  customer: null,
  legs: [],
  materials: [],
  photos: [],
  worklog: []
};

describe('WorkSessionPage', () => {
  it('renders pills, timer card, and submits materials, photos and work log', async () => {
    detailMock.mockReturnValue({ success: true, ticket: { ...BASE_TICKET } });
    submitMock.mockImplementation((_input, opts) =>
      opts?.onSuccess?.({ success: true, isLastLeg: true, nextLeg: null })
    );

    render(
      <I18nextProvider i18n={i18n}>
        <WorkSessionPage ticketId={7} />
      </I18nextProvider>
    );

    expect(screen.getByText(/elapsed-timer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add-photo/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add-log/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /add-photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /add-log/i }));
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 7,
          log: [{ kind: 'note', body: 'logged' }]
        }),
        expect.anything()
      )
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/dashboard/tickets/$ticketId/completed',
          params: { ticketId: String(7) }
        })
      )
    );
  });

  it('navigates to handoff when a next leg remains', async () => {
    detailMock.mockReturnValue({ success: true, ticket: { ...BASE_TICKET } });
    submitMock.mockImplementation((_input, opts) =>
      opts?.onSuccess?.({
        success: true,
        isLastLeg: false,
        nextLeg: { legNumber: 2, name: 'Install' }
      })
    );

    render(
      <I18nextProvider i18n={i18n}>
        <WorkSessionPage ticketId={7} />
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /add-photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/dashboard/work-session/$ticketId/handoff' })
      )
    );
  });

  it('shows a not-in-progress message for other statuses', () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: { ...BASE_TICKET, status: 'open' }
    });
    render(
      <I18nextProvider i18n={i18n}>
        <WorkSessionPage ticketId={7} />
      </I18nextProvider>
    );
    expect(screen.getByText(/notInProgress|not in progress/i)).toBeTruthy();
  });
});
