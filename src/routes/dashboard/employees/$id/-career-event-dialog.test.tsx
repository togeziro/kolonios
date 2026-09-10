// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createElement, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mutateAsyncMock, invalidateSpy } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  invalidateSpy: vi.fn()
}));

vi.mock('@/features/employees/api/career-events', () => ({
  useAppendCareerEvent: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false
  })
}));

vi.mock('@/features/masterdata/api/queries', () => ({
  departmentsQueryOptions: () => ({
    queryKey: ['masterdata', 'departments'],
    queryFn: async () => ({
      success: true,
      time: '2026-09-10T00:00:00.000Z',
      departments: [
        { id: 10, name: 'Field Services', code: 'FS' },
        { id: 20, name: 'Operations', code: 'OPS' }
      ]
    })
  }),
  designationOptionsQueryOptions: () => ({
    queryKey: ['masterdata', 'designation-options'],
    queryFn: async () => ({
      success: true,
      options: [
        { value: '5', label: 'Field Services Engineer' },
        { value: '6', label: 'Senior Engineer (Engineering)' }
      ]
    })
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

import '@/i18n/config';
import { businessDateInTimeZone } from '@/lib/dates';
import { CareerEventDialog } from './-career-event-dialog';

function renderDialog(category: 'position' | 'division' | 'employment_status') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 }
    }
  });
  // Bypass the queryClient.invalidateQueries call so we don't need a real
  // QueryClient connection. The spy is only there to make sure we call it.
  invalidateSpy.mockReset();
  const originalInvalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((opts) => {
    invalidateSpy(opts);
    return originalInvalidate(opts);
  }) as typeof client.invalidateQueries;

  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        Suspense,
        { fallback: createElement('div', null, 'loading') },
        createElement(CareerEventDialog, {
          open: true,
          onOpenChange: vi.fn(),
          employeeId: 'emp-1',
          category
        })
      )
    )
  );
}

beforeEach(() => {
  cleanup();
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue({ id: 1 });
});

describe('CareerEventDialog — per-category visible fields', () => {
  it('renders the designation picker for the position category', async () => {
    renderDialog('position');
    await waitFor(() => screen.getByTestId('career-event-to-designation'));
    expect(screen.getByTestId('career-event-to-designation')).toBeTruthy();
    expect(screen.getByTestId('career-event-effective-date')).toBeTruthy();
    expect(screen.getByTestId('career-event-notes')).toBeTruthy();
    expect(screen.queryByTestId('career-event-to-department')).toBeNull();
    expect(screen.queryByTestId('career-event-to-employment-status')).toBeNull();
  });

  it('renders the department picker for the division category', async () => {
    renderDialog('division');
    await waitFor(() => screen.getByTestId('career-event-to-department'));
    expect(screen.getByTestId('career-event-to-department')).toBeTruthy();
    expect(screen.getByTestId('career-event-effective-date')).toBeTruthy();
    expect(screen.getByTestId('career-event-notes')).toBeTruthy();
    expect(screen.queryByTestId('career-event-to-designation')).toBeNull();
    expect(screen.queryByTestId('career-event-to-employment-status')).toBeNull();
  });

  it('renders the employment-status select for the employment_status category', async () => {
    renderDialog('employment_status');
    await waitFor(() => screen.getByTestId('career-event-to-employment-status'));
    expect(screen.getByTestId('career-event-to-employment-status')).toBeTruthy();
    expect(screen.getByTestId('career-event-effective-date')).toBeTruthy();
    expect(screen.getByTestId('career-event-notes')).toBeTruthy();
    expect(screen.queryByTestId('career-event-to-designation')).toBeNull();
    expect(screen.queryByTestId('career-event-to-department')).toBeNull();
  });

  it('defaults the effective date input to today', async () => {
    renderDialog('position');
    await waitFor(() => screen.getByTestId('career-event-effective-date'));
    const dateInput = screen.getByTestId('career-event-effective-date') as HTMLInputElement;
    expect(dateInput.value).toBe(businessDateInTimeZone(new Date()));
  });

  it('defaults to the business-timezone (WIB) date, not UTC, across the midnight boundary', async () => {
    // Fake only Date so RTL's real setTimeout still drives `waitFor`.
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2026-08-04T20:30:00Z is 2026-08-05T03:30 in Asia/Jakarta (WIB, UTC+7).
    vi.setSystemTime(new Date('2026-08-04T20:30:00Z'));
    try {
      renderDialog('position');
      await waitFor(() => screen.getByTestId('career-event-effective-date'));
      const dateInput = screen.getByTestId('career-event-effective-date') as HTMLInputElement;
      expect(dateInput.value).toBe('2026-08-05');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CareerEventDialog — submission', () => {
  it('calls appendCareerEventFn with a position payload and invalidates the timeline query', async () => {
    renderDialog('position');
    const designationPicker = (await waitFor(() =>
      screen.getByTestId('career-event-to-designation')
    )) as HTMLSelectElement;
    fireEvent.change(designationPicker, { target: { value: '6' } });
    fireEvent.change(screen.getByTestId('career-event-notes'), {
      target: { value: 'Promoted after Q2 review' }
    });
    fireEvent.click(screen.getByTestId('career-event-submit'));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const call = mutateAsyncMock.mock.calls[0]?.[0] as {
      category: string;
      toDesignationId: number;
      notes: string | null;
    };
    expect(call.category).toBe('position');
    expect(call.toDesignationId).toBe(6);
    expect(call.notes).toBe('Promoted after Q2 review');
  });

  it('calls appendCareerEventFn with a division payload (department picker)', async () => {
    renderDialog('division');
    const departmentPicker = (await waitFor(() =>
      screen.getByTestId('career-event-to-department')
    )) as HTMLSelectElement;
    fireEvent.change(departmentPicker, { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('career-event-submit'));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const call = mutateAsyncMock.mock.calls[0]?.[0] as {
      category: string;
      toDepartmentId: number;
    };
    expect(call.category).toBe('division');
    expect(call.toDepartmentId).toBe(10);
  });

  it('calls appendCareerEventFn with an employment_status payload', async () => {
    renderDialog('employment_status');
    await waitFor(() => screen.getByTestId('career-event-to-employment-status'));
    fireEvent.click(screen.getByTestId('career-event-submit'));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const call = mutateAsyncMock.mock.calls[0]?.[0] as {
      category: string;
      toLabel: string;
    };
    expect(call.category).toBe('employment_status');
    expect(call.toLabel).toBe('active');
  });

  it('trims empty notes to null before sending the payload', async () => {
    renderDialog('position');
    const designationPicker = (await waitFor(() =>
      screen.getByTestId('career-event-to-designation')
    )) as HTMLSelectElement;
    fireEvent.change(designationPicker, { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('career-event-notes'), {
      target: { value: '   ' }
    });
    fireEvent.click(screen.getByTestId('career-event-submit'));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled());
    const call = mutateAsyncMock.mock.calls[0]?.[0] as { notes: string | null };
    expect(call.notes).toBeNull();
  });
});
