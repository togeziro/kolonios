// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ShiftFormSheet } from './shift-form-sheet';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

beforeEach(() => {
  useQueryMock.mockReset();
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof ShiftFormSheet>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ShiftFormSheet open onOpenChange={() => undefined} {...overrides} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe('ShiftFormSheet — Add mode', () => {
  it('seeds defaults (Mon–Fri working, 08:00–17:00, tolerance 5, cutoff 120)', () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false
    });
    renderSheet();

    const nameInput = screen.getByLabelText(/Shift Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('');

    const startInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement;
    expect(startInput.value).toBe('08:00');

    const endInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    expect(endInput.value).toBe('17:00');

    const lateInput = screen.getByLabelText(/Late Tolerance/i) as HTMLInputElement;
    expect(lateInput.value).toBe('5');

    const cutoffInput = screen.getByLabelText(/Absence Cutoff/i) as HTMLInputElement;
    expect(cutoffInput.value).toBe('120');
  });

  it('hides the status switch on Add (active is implicit)', () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false, isPending: false });
    renderSheet();
    expect(screen.queryByLabelText(/^Active$/i)).toBeNull();
  });
});

describe('ShiftFormSheet — Edit mode', () => {
  it('hides the save button until the shift loads', () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true, isPending: true });
    renderSheet({ shiftId: 7 });
    const buttons = screen.getAllByRole('button', { name: /Create|Update/i });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('hydrates the form from the loaded shift', () => {
    useQueryMock.mockReturnValue({
      data: {
        success: true,
        shift: {
          id: 7,
          name: 'Morning',
          start_time: '07:30',
          end_time: '16:30',
          break_start: '12:00',
          break_end: '13:00',
          max_break_minutes: 60,
          color: '#0ea5e9',
          note: 'Crew A',
          late_tolerance_minutes: 7,
          absence_cutoff_minutes: 90,
          status: 'active'
        },
        weekdayRules: [
          { day_of_week: 1, is_working_day: true, start_time: '07:30', end_time: '16:30' },
          { day_of_week: 2, is_working_day: true, start_time: '07:30', end_time: '16:30' },
          { day_of_week: 0, is_working_day: false, start_time: null, end_time: null }
        ]
      },
      isLoading: false,
      isPending: false,
      dataUpdatedAt: Date.now()
    });
    renderSheet({ shiftId: 7 });

    expect((screen.getByLabelText(/Shift Name/i) as HTMLInputElement).value).toBe('Morning');
    expect((screen.getByLabelText(/Start Time/i) as HTMLInputElement).value).toBe('07:30');
    expect((screen.getByLabelText(/Late Tolerance/i) as HTMLInputElement).value).toBe('7');
    // Status switch is visible in edit mode.
    expect(screen.getByLabelText(/^Active$/i)).toBeTruthy();
  });
});

describe('ShiftFormSheet — weekday rules', () => {
  it('renders every weekday row with its day label', () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false, isPending: false });
    renderSheet();
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(day)).toBeTruthy();
    }
  });

  it('keeps Sat/Sun unchecked and Mon–Fri checked by default', () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false, isPending: false });
    renderSheet();
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const states: Record<string, boolean> = {};
    for (const day of dayLabels) {
      const row = screen.getByText(day).closest('div.flex');
      const checkbox = row!.querySelector('[role=checkbox]') as HTMLElement;
      states[day] = checkbox.getAttribute('aria-checked') === 'true';
    }
    expect(states).toEqual({
      Sun: false,
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: false
    });
  });
});
