// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const { mutateAsyncMock, isPendingRef, toastSuccess, toastError, session } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  isPendingRef: { value: false },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  session: { currentId: 'actor-1' }
}));

vi.mock('@/lib/auth/auth-client', () => ({
  useSession: () => ({
    data: {
      user: { id: session.currentId, name: 'HR Admin', email: 'hr@example.com' }
    }
  })
}));

vi.mock('@/features/employees/api/career-events', () => ({
  useDeleteCareerEvent: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: isPendingRef.value
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError
  }
}));

import '@/i18n/config';
import { CareerEventCard } from './-career-event-card';
import type { CareerTimelineEvent } from '@/features/employees/api/career-events';

function makeEvent(
  overrides: Partial<CareerTimelineEvent> & Pick<CareerTimelineEvent, 'id'>
): CareerTimelineEvent {
  return {
    category: 'position',
    effective_date: '2026-01-15',
    notes: null,
    actor_user_id: 'actor-1',
    from_designation_id: 1,
    to_designation_id: 2,
    from_department_id: null,
    to_department_id: null,
    from_label: 'Helper',
    to_label: 'Engineer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

beforeEach(() => {
  cleanup();
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue({ id: 1 });
  toastSuccess.mockReset();
  toastError.mockReset();
  isPendingRef.value = false;
  session.currentId = 'actor-1';
});

describe('CareerEventCard — trash visibility', () => {
  it('shows the trash icon when the event is fresh and recorded by the current user', () => {
    render(<CareerEventCard event={makeEvent({ id: 1, created_at: minutesAgo(1) })} />);
    expect(screen.getByTestId('career-event-delete')).toBeTruthy();
  });

  it('hides the trash icon when the event is older than 5 minutes', () => {
    render(<CareerEventCard event={makeEvent({ id: 1, created_at: minutesAgo(6) })} />);
    expect(screen.queryByTestId('career-event-delete')).toBeNull();
  });

  it('hides the trash icon when a different user recorded the event', () => {
    render(
      <CareerEventCard
        event={makeEvent({ id: 1, actor_user_id: 'someone-else', created_at: minutesAgo(1) })}
      />
    );
    expect(screen.queryByTestId('career-event-delete')).toBeNull();
  });

  it('hides the trash icon for system-seeded events (NULL actor)', () => {
    render(
      <CareerEventCard
        event={makeEvent({ id: 1, actor_user_id: null, created_at: minutesAgo(1) })}
      />
    );
    expect(screen.queryByTestId('career-event-delete')).toBeNull();
  });
});

describe('CareerEventCard — delete confirmation', () => {
  it('opens a confirm dialog showing the from → to description', async () => {
    render(<CareerEventCard event={makeEvent({ id: 7, created_at: minutesAgo(1) })} />);

    fireEvent.click(screen.getByTestId('career-event-delete'));

    expect(await screen.findByText('Delete this event?')).toBeTruthy();
    expect(screen.getByText(/Helper → Engineer/)).toBeTruthy();
  });

  it('keeps the event when the dialog is cancelled', async () => {
    render(<CareerEventCard event={makeEvent({ id: 7, created_at: minutesAgo(1) })} />);

    fireEvent.click(screen.getByTestId('career-event-delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Delete this event?')).toBeNull());
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('calls deleteCareerEventFn with the event id on confirm and reports success', async () => {
    render(<CareerEventCard event={makeEvent({ id: 7, created_at: minutesAgo(1) })} />);

    fireEvent.click(screen.getByTestId('career-event-delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledWith(7));
    expect(toastSuccess).toHaveBeenCalledWith('Career event deleted');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('surfaces the forbidden translation key when the server rejects the delete', async () => {
    const error = Object.assign(new Error('forbidden'), {
      code: 'CAREER_EVENT_DELETE_FORBIDDEN'
    });
    mutateAsyncMock.mockRejectedValueOnce(error);

    render(<CareerEventCard event={makeEvent({ id: 7, created_at: minutesAgo(1) })} />);

    fireEvent.click(screen.getByTestId('career-event-delete'));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('This event can no longer be deleted.')
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
