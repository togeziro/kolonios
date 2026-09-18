// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { addDays, format } from 'date-fns';
import { enUS, id as idLocale } from 'date-fns/locale';
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

// userEvent dispatches real pointer events; Radix's dismissable layer
// probes pointer-capture APIs that jsdom doesn't implement.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
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

// ----- Interaction helpers -----

async function selectShift(name: string) {
  const user = userEvent.setup();
  const trigger = (await screen.findByTestId('assign-dialog-shift-trigger')) as HTMLButtonElement;
  await user.click(trigger);
  const option = (await screen.findByRole('option', { name })) as HTMLElement;
  await user.click(option);
}

/**
 * Pick a To date through the DatePicker calendar (bounded assignments only —
 * the dialog blocks submit while this is empty). Navigates months forward
 * until the target day button appears (robust across month boundaries).
 * Returns the picked date as YYYY-MM-DD.
 */
async function pickToDate(daysAhead = 5): Promise<string> {
  const user = userEvent.setup();
  const trigger = document.getElementById('effectiveTo');
  if (!trigger) throw new Error('To-date picker trigger not found');
  await user.click(trigger);
  const target = addDays(new Date(), daysAhead);
  // The calendar's aria-labels follow the app locale (`dateFnsLocale()`),
  // which defaults to Indonesian in tests regardless of the i18n language —
  // try both label shapes.
  const labels = [
    format(target, 'PPPP', { locale: enUS }),
    format(target, 'PPPP', { locale: idLocale })
  ];
  let day: HTMLElement | null | undefined = null;
  for (let i = 0; i < 4 && !day; i += 1) {
    day = labels
      .map((label) => screen.queryByRole('button', { name: label }))
      .find((found) => found != null);
    if (!day) {
      const next = screen.queryByRole('button', { name: /next month/i });
      if (!next) break;
      await user.click(next);
    }
  }
  if (!day) throw new Error(`To-date day button not found: ${labels.join(' / ')}`);
  const picked = day;
  await user.click(picked);
  return format(target, 'yyyy-MM-dd');
}

async function submitDialog() {
  const user = userEvent.setup();
  const submit = await screen.findByTestId('assign-dialog-submit');
  await user.click(submit);
}

// ----- Tests -----

describe('AssignShiftDialog', () => {
  it('renders the title + description in English when open', async () => {
    renderDialog({ open: true });
    await waitFor(() => {
      expect(screen.getByText('Assign Shift')).toBeInTheDocument();
    });
    expect(screen.getByText(/Aldi Pranata/)).toBeInTheDocument();
  });

  it('renders the required-marker asterisk on the Shift + From + To date labels', async () => {
    renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));
    expect(screen.getByText('Shift')).toBeInTheDocument();
    expect(screen.getByText('From date')).toBeInTheDocument();
    // The To-date placeholder duplicates the label text, so assert on the
    // <label> element directly.
    const toLabel = document.querySelector('label[for="effectiveTo"]');
    expect(toLabel?.textContent).toContain('To date');
    expect(toLabel?.textContent).toContain('*');
    // All three labels must carry the required-marker '*' (UI convention
    // for field-level `required` per repo audit; To date is required since
    // assignments are bounded-only).
    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the bounded-assignment awareness hint under the To date', async () => {
    renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));
    const hint = await screen.findByTestId('assign-dialog-todate-hint');
    expect(hint.textContent).toMatch(/bounded/i);
  });

  it('blocks submit with an inline error when the To date is empty', async () => {
    renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));
    await selectShift('Morning');
    await submitDialog();

    // Inline field error (not a toast): the server fn must never fire.
    await waitFor(() => {
      expect(screen.getByText('To date is required.')).toBeInTheDocument();
    });
    expect(createAssignmentInlineFnMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('calls createAssignmentInlineFn on submit with the chosen shift + dates', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: true,
      assignment: { id: 99, effective_from: '2026-09-01' }
    });
    const { onOpenChange } = renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    // Pick shift id=1 via the mocked Select trigger.
    // NOTE: pick the To date BEFORE touching the shift Select — Radix
    // layering swallows the DatePicker trigger click while the Select
    // popover interaction is still settling.
    const expectedTo = await pickToDate();
    await selectShift('Morning');
    await submitDialog();

    await waitFor(() => {
      expect(createAssignmentInlineFnMock).toHaveBeenCalledTimes(1);
    });
    const call = createAssignmentInlineFnMock.mock.calls[0]?.[0] as
      | { data: { userId: string; shiftId: number; effectiveFrom: string; effectiveTo: string } }
      | undefined;
    expect(call?.data.userId).toBe('u-1');
    expect(call?.data.shiftId).toBe(1);
    expect(typeof call?.data.effectiveFrom).toBe('string');
    expect(call?.data.effectiveTo).toBe(expectedTo);
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

    await pickToDate();
    await selectShift('Morning');
    await submitDialog();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    // Dialog should remain open (parent's onOpenChange NOT called with false).
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open + shows the required toast on effectiveToRequired', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: false,
      error: 'effectiveToRequired'
    });
    const { onOpenChange } = renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    await pickToDate();
    await selectShift('Morning');
    await submitDialog();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(String(toastErrorMock.mock.calls[0]?.[0] ?? '')).toMatch(/To date is required/);
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open + shows the close-guard toast on closeWouldInvertRange', async () => {
    createAssignmentInlineFnMock.mockResolvedValue({
      success: false,
      error: 'closeWouldInvertRange',
      conflictingFrom: '2026-09-08'
    });
    const { onOpenChange } = renderDialog({ open: true });
    await waitFor(() => screen.getByText('Assign Shift'));

    await pickToDate();
    await selectShift('Morning');
    await submitDialog();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock.mock.calls[0]?.[0]).toContain('2026-09-08');
    expect(toastSuccessMock).not.toHaveBeenCalled();
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
    const user = userEvent.setup();
    const trigger = (await screen.findByTestId('assign-dialog-shift-trigger')) as HTMLButtonElement;
    await user.click(trigger);
    const option = (await screen.findByRole('option', {
      name: 'Night (no policy)'
    })) as HTMLElement;
    await user.click(option);

    // Policy banner should be visible inside the dialog.
    await waitFor(() => {
      expect(screen.getByTestId('assign-dialog-policy-warning')).toBeInTheDocument();
    });

    await pickToDate();
    await submitDialog();

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
      expect(screen.getByText('Tanggal mulai')).toBeInTheDocument();
    });
    // Submit button should also be in Indonesian.
    expect(screen.getByTestId('assign-dialog-submit').textContent).toMatch(/Simpan/);
    // The description interpolation should keep the user name.
    expect(screen.getByText(/Aldi Pranata/)).toBeInTheDocument();
  });
});
