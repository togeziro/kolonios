// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import {
  AdminAttendanceAddDialog,
  type AdminAttendanceDialogInitial,
  type AdminAttendanceDialogMode
} from './admin-attendance-add-dialog';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// ----- Mocks -----

const recordManualAttendanceFnMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../api/service', () => ({
  recordManualAttendanceFn: (...args: unknown[]) => recordManualAttendanceFnMock(...args)
}));

vi.mock('../api/queries', () => ({
  attendanceKeys: {
    all: ['attendance']
  }
}));

vi.mock('@/features/employees/api/queries', () => ({
  employeesQueryOptions: () => ({
    queryKey: ['employees', 'list', { limit: 100 }],
    queryFn: async () => ({
      success: true,
      employees: [
        { id: 'emp-1', full_name: 'Aldi Pranata', email: 'aldi@example.com' },
        { id: 'emp-2', full_name: 'Budi Santoso', email: 'budi@example.com' }
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
  mode?: AdminAttendanceDialogMode;
  initial?: AdminAttendanceDialogInitial;
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
          createElement(AdminAttendanceAddDialog, {
            open: props.open,
            onOpenChange,
            mode: props.mode ?? 'create',
            initial: props.initial
          })
        )
      )
    )
  };
}

async function fillCreateForm() {
  const employee = (await screen.findByTestId('manual-attendance-employee')) as HTMLSelectElement;
  await screen.findByRole('option', { name: 'Aldi Pranata' });
  await act(async () => {
    fireEvent.change(employee, { target: { value: 'emp-1' } });
  });
  const checkIn = (await screen.findByTestId('manual-attendance-check-in')) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(checkIn, { target: { value: '08:00' } });
  });
  const checkOut = (await screen.findByTestId('manual-attendance-check-out')) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(checkOut, { target: { value: '13:00' } });
  });
}

beforeEach(() => {
  recordManualAttendanceFnMock.mockReset();
  invalidateQueriesMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  i18n.changeLanguage('en');
});

// ----- Tests -----

describe('AdminAttendanceAddDialog', () => {
  it('renders the Add Attendance title + description when open in create mode', async () => {
    renderDialog({ open: true });
    await waitFor(() => {
      expect(screen.getByText('Add Attendance')).toBeTruthy();
    });
    expect(screen.getByText('Record an attendance entry manually for an employee')).toBeTruthy();
  });

  it('submits confirmOverwrite: false first, then true on the confirm step', async () => {
    recordManualAttendanceFnMock
      .mockResolvedValueOnce({
        kind: 'overwrite_required',
        existing: { check_in_time: '07:30', check_out_time: '12:00' }
      })
      .mockResolvedValueOnce({
        kind: 'overwritten',
        row: { check_in_time: '08:00', check_out_time: '13:00' }
      });
    renderDialog({ open: true });

    await fillCreateForm();
    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => {
      expect(recordManualAttendanceFnMock).toHaveBeenCalledTimes(1);
    });
    const first = recordManualAttendanceFnMock.mock.calls[0]?.[0] as
      | { data: { employeeId: string; confirmOverwrite: boolean } }
      | undefined;
    expect(first?.data.employeeId).toBe('emp-1');
    expect(first?.data.confirmOverwrite).toBe(false);

    // The overwrite prompt should render with the existing-row summary.
    await waitFor(() => {
      expect(screen.getByText('Overwrite existing entry?')).toBeTruthy();
    });
    expect(screen.getByText(/07:30/)).toBeTruthy();
    expect(screen.getAllByText(/Aldi Pranata/).length).toBeGreaterThan(0);

    // Confirm the overwrite.
    const confirmButton = screen.getByRole('button', { name: 'Overwrite' }) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(recordManualAttendanceFnMock).toHaveBeenCalledTimes(2);
    });
    const second = recordManualAttendanceFnMock.mock.calls[1]?.[0] as
      | { data: { confirmOverwrite: boolean } }
      | undefined;
    expect(second?.data.confirmOverwrite).toBe(true);

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['attendance'] });
  });

  it('keeps the overwrite prompt open when the confirm call fails', async () => {
    recordManualAttendanceFnMock
      .mockResolvedValueOnce({
        kind: 'overwrite_required',
        existing: { check_in_time: '07:30', check_out_time: '12:00' }
      })
      .mockRejectedValueOnce(new Error('boom'));
    renderDialog({ open: true });

    await fillCreateForm();
    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => {
      expect(screen.getByText('Overwrite existing entry?')).toBeTruthy();
    });

    const confirmButton = screen.getByRole('button', { name: 'Overwrite' }) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    // Prompt stays open for a retry.
    expect(screen.getByText('Overwrite existing entry?')).toBeTruthy();
    expect(recordManualAttendanceFnMock).toHaveBeenCalledTimes(2);
  });

  it('shows field errors and does not submit when required fields are empty', async () => {
    renderDialog({ open: true });

    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(save);
    });

    // Field validators run on submit: employee + clock-in are empty.
    await waitFor(() => {
      expect(screen.getByText('Select an employee')).toBeTruthy();
    });
    expect(screen.getByText('Enter a clock-in time')).toBeTruthy();
    expect(recordManualAttendanceFnMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('closes + toasts on a plain created result (no conflict)', async () => {
    recordManualAttendanceFnMock.mockResolvedValueOnce({
      kind: 'created',
      row: { check_in_time: '08:00', check_out_time: '13:00' }
    });
    const { onOpenChange } = renderDialog({ open: true });

    await fillCreateForm();
    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(save);
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders edit mode with locked employee/date and Edit Attendance title', async () => {
    renderDialog({
      open: true,
      mode: 'edit',
      initial: {
        employeeId: 'emp-1',
        date: '2026-08-03',
        checkInTime: '08:00',
        checkOutTime: '13:00'
      }
    });
    await waitFor(() => {
      expect(screen.getByText('Edit Attendance')).toBeTruthy();
    });

    const employee = (await screen.findByTestId('manual-attendance-employee')) as HTMLSelectElement;
    expect(employee.disabled).toBe(true);
    expect(employee.value).toBe('emp-1');

    // The DatePicker trigger should be disabled in edit mode.
    const buttons = screen.getAllByRole('button');
    expect(buttons.some((b) => (b as HTMLButtonElement).disabled)).toBe(true);

    // Lock hint is visible.
    expect(screen.getByText(/locked while editing/i)).toBeTruthy();

    // Times are prefilled from the row.
    const checkIn = (await screen.findByTestId('manual-attendance-check-in')) as HTMLInputElement;
    const checkOut = (await screen.findByTestId('manual-attendance-check-out')) as HTMLInputElement;
    expect(checkIn.value).toBe('08:00');
    expect(checkOut.value).toBe('13:00');

    // Save label is the edit-mode one.
    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    expect(save.textContent).toMatch(/Save Changes/);
  });

  it('round-trips locale: Indonesian title in id mode', async () => {
    await i18n.changeLanguage('id');
    renderDialog({ open: true });
    await waitFor(() => {
      expect(screen.getByText('Tambah Kehadiran')).toBeTruthy();
    });
    const save = (await screen.findByTestId('manual-attendance-save')) as HTMLButtonElement;
    expect(save.textContent).toMatch(/Simpan/);
  });
});
