// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { AssignShiftDialog } from './assign-shift-dialog';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Radix Select relies on scrollIntoView; jsdom doesn't implement it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// ----- Mocks -----

const createAssignmentInlineFnMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../api/service', () => ({
  createAssignmentInlineFn: (...args: unknown[]) => createAssignmentInlineFnMock(...args)
}));

vi.mock('@/features/attendance/api/queries', () => ({
  attendanceKeys: {
    all: ['attendance'],
    assignments: () => ['attendance', 'assignments'],
    effectiveSchedule: () => ['attendance', 'effective-schedule']
  },
  listShiftsQueryOptions: () => ({
    queryKey: ['attendance', 'shifts-list'],
    queryFn: async () => ({
      success: true,
      shifts: [
        {
          id: 1,
          name: 'Morning',
          start_time: '08:00',
          end_time: '17:00',
          late_tolerance_minutes: 5,
          absence_cutoff_minutes: 120,
          used: false
        },
        {
          id: 2,
          name: 'Night (no policy)',
          start_time: '20:00',
          end_time: '05:00',
          late_tolerance_minutes: null,
          absence_cutoff_minutes: null,
          used: false
        }
      ]
    })
  })
}));

vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock
    })
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args)
  }
}));

// ----- Helpers -----

function renderDialog(props: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  userId?: string | null;
  userName?: string;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const onOpenChange = props.onOpenChange ?? vi.fn();
  return {
    onOpenChange,
    ...render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          I18nextProvider,
          { i18n },
          createElement(AssignShiftDialog, {
            open: props.open,
            onOpenChange,
            userId: props.userId ?? 'u-1',
            userName: props.userName ?? 'Aldi Pranata'
          })
        )
      )
    )
  };
}

beforeEach(() => {
  createAssignmentInlineFnMock.mockReset();
  invalidateQueriesMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  i18n.changeLanguage('en');
});

// ----- Tests -----

describe('AssignShiftDialog', () => {
  it('renders the title + description in English when open', async () => {
    renderDialog({ open: true });
    await waitFor(() => {
      expect(screen.getByText('Assign Shift')).toBeTruthy();
    });
    expect(screen.getByText(/Aldi Pranata/)).toBeTruthy();
  });

  it('renders the required-marker asterisk on the Shift + From date labels', async () => {
    renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));
    expect(screen.getByText('Shift')).toBeTruthy();
    expect(screen.getByText('From date')).toBeTruthy();
    // Both labels must end with the required-marker '*' (UI convention for
    // field-level `required` per repo audit).
    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(2);
  });

  it('calls createAssignmentInlineFn on submit with the chosen shift + dates', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: true,
      assignment: { id: 99, effective_from: '2026-09-01' }
    });
    const { onOpenChange } = renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    // Pick shift id=1 via the mocked Select trigger.
    const trigger = (await screen.findByTestId('assign-dialog-shift-trigger')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option = (await screen.findByRole('option', {
      name: 'Morning'
    })) as HTMLElement;
    await act(async () => {
      fireEvent.click(option);
    });

    const submit = await screen.findByTestId('assign-dialog-submit');
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(createAssignmentInlineFnMock).toHaveBeenCalledTimes(1);
    });
    const call = createAssignmentInlineFnMock.mock.calls[0]?.[0] as
      | { data: { userId: string; shiftId: number; effectiveFrom: string } }
      | undefined;
    expect(call?.data.userId).toBe('u-1');
    expect(call?.data.shiftId).toBe(1);
    expect(typeof call?.data.effectiveFrom).toBe('string');
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open + shows an error toast on cross-field rejection', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: false,
      error: 'effectiveToBeforeFrom'
    });
    const { onOpenChange } = renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    const trigger = (await screen.findByTestId('assign-dialog-shift-trigger')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option = (await screen.findByRole('option', {
      name: 'Morning'
    })) as HTMLElement;
    await act(async () => {
      fireEvent.click(option);
    });
    const submit = await screen.findByTestId('assign-dialog-submit');
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    // Dialog should remain open (parent's onOpenChange NOT called with false).
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('appends the closingNote + policyWarning to the success toast when both fire', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: true,
      assignment: { id: 99, effective_from: '2026-09-01' },
      closedAssignment: {
        id: 12,
        effective_from: '2026-01-01',
        effective_to: '2026-08-31',
        user_id: 'u-1',
        shift_id: 1,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    // Choose shift id=2 (no policy) so both warnings fire.
    const trigger = (await screen.findByTestId('assign-dialog-shift-trigger')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option = (await screen.findByRole('option', {
      name: 'Night (no policy)'
    })) as HTMLElement;
    await act(async () => {
      fireEvent.click(option);
    });

    // Policy banner should be visible inside the dialog.
    await waitFor(() => {
      expect(screen.getByTestId('assign-dialog-policy-warning')).toBeTruthy();
    });

    const submit = await screen.findByTestId('assign-dialog-submit');
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    });
    const message = String(toastSuccessMock.mock.calls[0]?.[0] ?? '');
    expect(message).toMatch(/Shift assigned/);
    expect(message).toMatch(/Aldi Pranata/);
    expect(message).toMatch(/2026-01-01/);
    expect(message).toMatch(/row may render blank/);
  });

  it('round-trips locale: Indonesian string for the title when language is id', async () => {
    await i18n.changeLanguage('id');
    renderDialog({ open: true });
    await waitFor(() => {
      // "Tanggal mulai" is the Indonesian-only label for the From date
      // picker — distinct from the English "From date". Both `en` and
      // `id` happen to use "Assign Shift" as the dialog title, so we
      // assert on a translation that is unique to the id locale.
      expect(screen.getByText('Tanggal mulai')).toBeTruthy();
    });
    // Submit button should also be in Indonesian.
    expect(screen.getByTestId('assign-dialog-submit').textContent).toMatch(/Simpan/);
    // The description interpolation should keep the user name.
    expect(screen.getByText(/Aldi Pranata/)).toBeTruthy();
  });
});
