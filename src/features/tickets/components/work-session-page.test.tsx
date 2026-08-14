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
  useSubmitWorkSession: () => ({ mutate: submitMock, isPending: false })
}));

vi.mock('./materials-used', () => ({
  default: () => <div>materials</div>
}));

vi.mock('./completion-photos', () => ({
  default: () => <div>photos</div>
}));

import WorkSessionPage from './work-session-page';

describe('WorkSessionPage', () => {
  it('submits the session with materials, photos and notes', async () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: {
        id: 7,
        ticketCode: 'T-7',
        title: 'Field install',
        status: 'in_progress',
        customer: null,
        legs: [],
        materials: [],
        photos: []
      }
    });

    render(
      <I18nextProvider i18n={i18n}>
        <WorkSessionPage ticketId={7} />
      </I18nextProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/notes/i), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: 7, notes: 'done' }),
        expect.anything()
      )
    );
  });

  it('shows a not-in-progress message for other statuses', () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: {
        id: 7,
        title: 'Open one',
        status: 'open',
        customer: null,
        legs: [],
        materials: [],
        photos: []
      }
    });

    render(
      <I18nextProvider i18n={i18n}>
        <WorkSessionPage ticketId={7} />
      </I18nextProvider>
    );

    expect(screen.getByText(/notInProgress|not in progress/i)).toBeTruthy();
  });
});
