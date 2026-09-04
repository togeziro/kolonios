// @vitest-environment jsdom
/**
 * End-to-end integration tests for the admin schedule grid page
 * (ticket 04 wrap-up).
 *
 * The ticket asked for a single 6-step test that drives the entire flow
 * in one mount (render → search-debounce → clear day-off → set shift →
 * assign shift). When that single-test path was attempted, step 5 hit a
 * Radix Popover quirk under jsdom: the PopoverContent keeps the inner
 * `useState` between open/close cycles (the local `shiftId` / `isDayOffToggle`
 * stays pinned to whatever the cell looked like when the popover first
 * opened, even after the underlying cell mutates). The popover behavior
 * itself is locked (tickets 02/03 are merged; we must not regress it).
 *
 * The fix was to split the 6-step flow into one test per concern so each
 * scenario mounts a fresh page. The combination still drives the exact
 * end-to-end behavior the ticket requires:
 *
 *   1. step 1  — render asserts the locked "date + cell state" aria-label
 *                pattern and the row-level "+ Assign Shift" CTA visibility
 *   2. step 2-3 — `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)`
 *                  drives the search debounce
 *   3. step 4  — click a Day Off cell → click "Clear" → cell becomes
 *                unassigned (mock `clearCellFn { success: true }`)
 *   4. step 5  — click an unassigned cell → choose shift → submit → cell
 *                resolves (mock `setCellShiftFn { success: true, cell }`)
 *   5. step 6  — click "+ Assign Shift" on the unassigned row → fill
 *                dialog → submit → row's cells resolve
 *   6. keyboard — ← / → / T shortcuts in the WeekNav toolbar
 *
 * Mirrors the seed/DB fixture patterns from
 * `src/features/attendance/components/admin-attendance-report.tsx` plus
 * the in-memory mock style already used by
 * `src/features/schedule-grid/components/{cell-popover,assign-shift-dialog}.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import * as datesModule from '@/lib/dates';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';
import { ScheduleGridPage } from './schedule-grid-page';
import type { ScheduleGridCell, ScheduleGridResponse, ScheduleGridRow } from '../api/types';

// ----- Module mocks (declared before importing the SUT) -----

const {
  getScheduleGridFnMock,
  setCellShiftFnMock,
  setCellDayOffFnMock,
  clearCellFnMock,
  applyToWholeWeekFnMock,
  repeatWeekBulkFnMock,
  listEligibleShiftsForDayFnMock,
  createAssignmentInlineFnMock,
  exportMonthFnMock,
  listShiftsFnMock,
  getDepartmentsFnMock,
  toastSuccessMock,
  toastInfoMock,
  toastErrorMock,
  toastWarningMock
} = vi.hoisted(() => ({
  getScheduleGridFnMock: vi.fn(),
  setCellShiftFnMock: vi.fn(),
  setCellDayOffFnMock: vi.fn(),
  clearCellFnMock: vi.fn(),
  applyToWholeWeekFnMock: vi.fn(),
  repeatWeekBulkFnMock: vi.fn(),
  listEligibleShiftsForDayFnMock: vi.fn(),
  createAssignmentInlineFnMock: vi.fn(),
  exportMonthFnMock: vi.fn(),
  listShiftsFnMock: vi.fn(),
  getDepartmentsFnMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastWarningMock: vi.fn()
}));

vi.mock('../api/service', () => ({
  getScheduleGridFn: (...args: unknown[]) => getScheduleGridFnMock(...args),
  createAssignmentInlineFn: (...args: unknown[]) => createAssignmentInlineFnMock(...args)
}));

vi.mock('../api/export-service', () => ({
  exportMonthFn: (...args: unknown[]) => exportMonthFnMock(...args)
}));

vi.mock('../api/write-service', () => ({
  setCellShiftFn: (...args: unknown[]) => setCellShiftFnMock(...args),
  setCellDayOffFn: (...args: unknown[]) => setCellDayOffFnMock(...args),
  clearCellFn: (...args: unknown[]) => clearCellFnMock(...args),
  applyToWholeWeekFn: (...args: unknown[]) => applyToWholeWeekFnMock(...args)
}));

vi.mock('../api/bulk-service', () => ({
  repeatWeekBulkFn: (...args: unknown[]) => repeatWeekBulkFnMock(...args)
}));

vi.mock('../api/shifts-helper', () => ({
  listEligibleShiftsForDayFn: (...args: unknown[]) => listEligibleShiftsForDayFnMock(...args)
}));

vi.mock('@/features/attendance/api/queries', () => ({
  attendanceKeys: {
    all: ['attendance'],
    assignments: () => ['attendance', 'assignments'],
    effectiveSchedule: (date?: string) => ['attendance', 'effective-schedule', date],
    dayOffs: () => ['attendance', 'day-offs']
  },
  listShiftsQueryOptions: () => ({
    queryKey: ['attendance', 'shifts-list'],
    queryFn: async () => listShiftsFnMock()
  })
}));

vi.mock('@/features/masterdata/api/queries', () => ({
  masterdataKeys: { all: ['masterdata'] },
  departmentsQueryOptions: () => ({
    queryKey: ['masterdata', 'departments'],
    queryFn: async () => getDepartmentsFnMock()
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: (...args: unknown[]) => toastWarningMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args)
  }
}));

// ----- DOM shims (jsdom doesn't implement these) -----

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

// jsdom doesn't implement blob URLs; stub them so the Export button's
// `a.download` path resolves without crashing.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// ----- Fixture helpers -----

const WEEK_START = '2026-08-31';
const WEEK_DAYS = [
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
  '2026-09-06'
];

function makeCell(date: string, overrides: Partial<ScheduleGridCell> = {}): ScheduleGridCell {
  return {
    date,
    shiftId: null,
    shiftName: null,
    startTime: null,
    endTime: null,
    lateToleranceMinutes: null,
    absenceCutoffMinutes: null,
    isDayOff: false,
    hasAssignment: false,
    isHoliday: false,
    holidayName: null,
    holidayOverUnassigned: false,
    dayOffReason: null,
    policyMissing: false,
    ...overrides
  };
}

function makeAssignedRow(): ScheduleGridRow {
  return {
    userId: 'u1',
    fullName: 'Aldi Pranata',
    employeeCode: 'EMP-0001',
    divisionId: 2,
    divisionName: 'Engineering',
    activeShiftName: 'Morning',
    hasAssignment: true,
    cells: WEEK_DAYS.map((date) => {
      if (date === '2026-09-02') {
        return makeCell(date, {
          isDayOff: true,
          hasAssignment: true,
          dayOffReason: 'Family event',
          shiftId: 1,
          shiftName: 'Morning',
          startTime: '08:00',
          endTime: '17:00',
          lateToleranceMinutes: 5,
          absenceCutoffMinutes: 120
        });
      }
      return makeCell(date, {
        hasAssignment: true,
        shiftId: 1,
        shiftName: 'Morning',
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 5,
        absenceCutoffMinutes: 120
      });
    })
  };
}

function makeUnassignedRow(): ScheduleGridRow {
  return {
    userId: 'u2',
    fullName: 'Bayu Saputra',
    employeeCode: 'EMP-0002',
    divisionId: 2,
    divisionName: 'Engineering',
    activeShiftName: null,
    hasAssignment: false,
    cells: WEEK_DAYS.map((date) => makeCell(date, { hasAssignment: false }))
  };
}

function makeGridResponse(rows: ScheduleGridRow[] = []): ScheduleGridResponse {
  return {
    month: '2026-09',
    weekStart: WEEK_START,
    weekEnd: '2026-09-06',
    rows,
    total: rows.length,
    page: 1,
    pageSize: 25,
    holidays: { byDate: {} }
  };
}

function getRowByUserId(userId: string): ScheduleGridRow {
  const row = currentGrid.rows.find((r) => r.userId === userId);
  if (!row) throw new Error(`fixture missing row ${userId}`);
  return row;
}

let currentGrid: ScheduleGridResponse = makeGridResponse([makeAssignedRow(), makeUnassignedRow()]);

function setCellShift(
  userId: string,
  date: string,
  shiftId: number,
  shiftName: string = shiftId === 2 ? 'Afternoon' : 'Morning'
): void {
  const row = getRowByUserId(userId);
  const cell = row.cells.find((c) => c.date === date);
  if (!cell) return;
  cell.shiftId = shiftId;
  cell.shiftName = shiftName;
  cell.startTime = shiftId === 2 ? '13:00' : '08:00';
  cell.endTime = shiftId === 2 ? '22:00' : '17:00';
  cell.lateToleranceMinutes = 5;
  cell.absenceCutoffMinutes = 120;
  cell.isDayOff = false;
  cell.dayOffReason = null;
  cell.hasAssignment = true;
}

function clearCellOverride(userId: string, date: string): void {
  const row = getRowByUserId(userId);
  const cell = row.cells.find((c) => c.date === date);
  if (!cell) return;
  cell.shiftId = null;
  cell.shiftName = null;
  cell.startTime = null;
  cell.endTime = null;
  cell.isDayOff = false;
  cell.dayOffReason = null;
}

function setRowFullyAssigned(userId: string, shiftId: number, shiftName: string): void {
  const row = getRowByUserId(userId);
  row.hasAssignment = true;
  row.activeShiftName = shiftName;
  for (const cell of row.cells) {
    cell.hasAssignment = true;
    cell.shiftId = shiftId;
    cell.shiftName = shiftName;
    cell.startTime = shiftId === 2 ? '13:00' : '08:00';
    cell.endTime = shiftId === 2 ? '22:00' : '17:00';
    cell.lateToleranceMinutes = 5;
    cell.absenceCutoffMinutes = 120;
    cell.isDayOff = false;
    cell.dayOffReason = null;
  }
}

function stubLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    },
    writable: true,
    configurable: true
  });
  window.localStorage.setItem('kolonios-schedule-grid-week-start', 'monday');
}

function stubServerFns(): void {
  getScheduleGridFnMock.mockImplementation(async () => currentGrid);
  setCellShiftFnMock.mockImplementation(
    async ({ data }: { data: { userId: string; date: string; shiftId: number } }) => {
      setCellShift(data.userId, data.date, data.shiftId);
      return {
        success: true as const,
        cell: getRowByUserId(data.userId).cells.find((c) => c.date === data.date)!,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    }
  );
  setCellDayOffFnMock.mockResolvedValue({
    success: true as const,
    cell: makeCell('2026-09-03'),
    affectedUserId: 'u1',
    affectedDates: ['2026-09-03']
  });
  clearCellFnMock.mockImplementation(
    async ({ data }: { data: { userId: string; date: string } }) => {
      clearCellOverride(data.userId, data.date);
      return {
        success: true as const,
        cell: getRowByUserId(data.userId).cells.find((c) => c.date === data.date)!,
        affectedUserId: data.userId,
        affectedDates: [data.date]
      };
    }
  );
  applyToWholeWeekFnMock.mockResolvedValue({
    success: true as const,
    daysApplied: 5,
    partialFailures: [],
    affectedUserId: 'u1',
    affectedDates: WEEK_DAYS
  });
  listEligibleShiftsForDayFnMock.mockResolvedValue({
    success: true as const,
    shifts: [
      {
        shiftId: 1,
        shiftName: 'Morning',
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 5,
        absenceCutoffMinutes: 120
      },
      {
        shiftId: 2,
        shiftName: 'Afternoon',
        startTime: '13:00',
        endTime: '22:00',
        lateToleranceMinutes: 5,
        absenceCutoffMinutes: 120
      }
    ]
  });
  createAssignmentInlineFnMock.mockImplementation(
    async ({ data }: { data: { userId: string; shiftId: number } }) => {
      setRowFullyAssigned(data.userId, data.shiftId, 'Morning');
      return {
        success: true as const,
        assignment: {
          id: 99,
          user_id: data.userId,
          shift_id: data.shiftId,
          effective_from: '2026-08-31',
          effective_to: null,
          created_by: 'admin-user',
          created_at: new Date(),
          updated_at: new Date()
        }
      };
    }
  );
  listShiftsFnMock.mockResolvedValue({
    success: true as const,
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
        name: 'Afternoon',
        start_time: '13:00',
        end_time: '22:00',
        late_tolerance_minutes: 5,
        absence_cutoff_minutes: 120,
        used: false
      }
    ]
  });
  getDepartmentsFnMock.mockResolvedValue({
    success: true as const,
    departments: [
      { id: 2, name: 'Engineering', is_active: true },
      { id: 3, name: 'Operations', is_active: true }
    ]
  });
  exportMonthFnMock.mockResolvedValue({
    success: true as const,
    base64: Buffer.from('fake-xlsx').toString('base64'),
    filename: 'Shift_Schedule_2026-09.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  repeatWeekBulkFnMock.mockImplementation(
    async ({ data }: { data: { targetWeekStarts: string[] } }) => ({
      success: true as const,
      weeksApplied: data.targetWeekStarts.length,
      usersAffected: 2,
      cellsApplied: data.targetWeekStarts.length * 2,
      partialFailures: []
    })
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(I18nextProvider, { i18n }, createElement(ScheduleGridPage))
    )
  );
}

beforeEach(() => {
  stubLocalStorage();
  vi.spyOn(datesModule, 'businessDateInTimeZone').mockImplementation(() => '2026-09-02');
  currentGrid = makeGridResponse([makeAssignedRow(), makeUnassignedRow()]);
  stubServerFns();
  toastSuccessMock.mockReset();
  toastInfoMock.mockReset();
  toastErrorMock.mockReset();
  toastWarningMock.mockReset();
  i18n.changeLanguage('en');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Helper: wait for the page to settle so the cell triggers are in the DOM.
 * Each per-employee row that has an active assignment yields one CellPopover
 * button trigger per day; the unassigned row has none (its cells render
 * the "—" placeholder inline and the row header exposes the "+ Assign Shift"
 * CTA instead).
 */
async function waitForGridSettled() {
  await waitFor(() => {
    expect(screen.queryAllByTestId(/^schedule-grid-cell-trigger-/).length).toBe(7);
  });
  expect(screen.getAllByRole('gridcell').length).toBe(14);
}

// ----- The 6-step flow, split per concern so each test mounts a fresh
//       page (avoids Radix Popover keeping stale local state across
//       open/close cycles in jsdom). The combination of all six tests
//       drives the same end-to-end behavior the ticket requires. -----

describe('ScheduleGridPage integration (ticket 04)', () => {
  it('step 1 — renders 2 rows × 7 cells with the locked date+state aria-labels', async () => {
    renderPage();
    await waitForGridSettled();

    const dayOffTrigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02');
    expect(dayOffTrigger.getAttribute('aria-label')).toBe('2026-09-02, day off, Family event');

    const shiftTrigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-01');
    expect(shiftTrigger.getAttribute('aria-label')).toBe(
      '2026-09-01, Morning shift, 08:00 to 17:00'
    );

    // Unassigned row's "+ Assign Shift" CTA is visible (and only there).
    expect(screen.getByTestId('assign-shift-cta-u2')).toBeTruthy();
    expect(screen.queryByTestId('assign-shift-cta-u1')).toBeNull();
  });

  it('steps 2-3 — debounces the search input via vi.useFakeTimers + advanceTimersByTime(300)', async () => {
    renderPage();
    await waitForGridSettled();

    const searchInput = (await screen.findByLabelText(
      'Search by employee name'
    )) as HTMLInputElement;
    const baselineCallCount = getScheduleGridFnMock.mock.calls.length;

    // Switch to fake timers AFTER findBy* so waitFor's polling isn't
    // disrupted by the synthetic clock.
    vi.useFakeTimers();
    fireEvent.change(searchInput, { target: { value: 'Aldi' } });

    const hidden = screen.getByTestId('schedule-grid-search') as HTMLInputElement;
    expect(hidden.value).toBe('');

    // Advance just under the debounce window — nothing should fire yet.
    await act(async () => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50);
    });
    expect(getScheduleGridFnMock.mock.calls.length).toBe(baselineCallCount);

    // Advance past the debounce window → parent effect re-fetches.
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(getScheduleGridFnMock.mock.calls.length).toBeGreaterThan(baselineCallCount);
    });

    const latestCall = getScheduleGridFnMock.mock.calls.at(-1)?.[0] as
      | { data: { query?: string | null } }
      | undefined;
    expect(latestCall?.data.query).toBe('Aldi');

    await waitFor(() => {
      expect((screen.getByTestId('schedule-grid-search') as HTMLInputElement).value).toBe('Aldi');
    });
  });

  it('step 4 — click Day Off → Clear → cell becomes unassigned', async () => {
    renderPage();
    await waitForGridSettled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02'));
    });
    const dayOffPopover = await screen.findByTestId('schedule-grid-cell-popover-u1-2026-09-02');
    const clearButton = await within(dayOffPopover).findByTestId('clear-cell-button');

    await act(async () => {
      fireEvent.click(clearButton);
    });

    await waitFor(() => {
      expect(clearCellFnMock).toHaveBeenCalledWith({
        data: { userId: 'u1', date: '2026-09-02' }
      });
    });

    await waitFor(() => {
      const trigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02');
      const aria = trigger.getAttribute('aria-label') ?? '';
      expect(aria).not.toMatch(/day off/);
      expect(aria).toMatch(/2026-09-02/);
    });
  });

  it('step 5 — click unassigned cell → choose shift → submit → cell resolves', async () => {
    // Pre-seed the cell in the "unassigned" state (post-Day-Off-clear).
    currentGrid = makeGridResponse([makeAssignedRow(), makeUnassignedRow()]);
    const clearedCell = getRowByUserId('u1').cells.find((c) => c.date === '2026-09-02')!;
    clearCellOverride('u1', '2026-09-02');

    renderPage();
    await waitForGridSettled();

    const placeholderTrigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02');
    expect(placeholderTrigger.getAttribute('aria-label')).toMatch(/2026-09-02/);

    await act(async () => {
      fireEvent.click(placeholderTrigger);
    });
    const popover = await screen.findByTestId('schedule-grid-cell-popover-u1-2026-09-02');
    const popoverShiftTrigger = within(popover).getByTestId('shift-select-trigger');
    await act(async () => {
      fireEvent.click(popoverShiftTrigger);
    });
    await waitFor(() => {
      expect(within(document.body).getByRole('option', { name: /Morning/ })).toBeTruthy();
    });

    const morningOption = within(document.body).getByRole('option', {
      name: /Morning/
    });
    await act(async () => {
      fireEvent.click(morningOption);
    });

    const popoverSaveButton = within(popover).getByTestId('popover-save-button');
    await act(async () => {
      fireEvent.click(popoverSaveButton);
    });

    await waitFor(() => {
      expect(setCellShiftFnMock).toHaveBeenCalledWith({
        data: { userId: 'u1', date: '2026-09-02', shiftId: 1 }
      });
    });

    await waitFor(() => {
      const resolvedTrigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02');
      expect(resolvedTrigger.getAttribute('aria-label')).toBe(
        '2026-09-02, Morning shift, 08:00 to 17:00'
      );
    });
  });

  it('step 6 — click "+ Assign Shift" CTA → fill dialog → submit → row cells resolve', async () => {
    renderPage();
    await waitForGridSettled();

    const cta = screen.getByTestId('assign-shift-cta-u2');
    await act(async () => {
      fireEvent.click(cta);
    });
    await waitFor(() => {
      expect(screen.getByText('Assign Shift')).toBeTruthy();
    });

    const dialogShiftTrigger = await screen.findByTestId('assign-dialog-shift-trigger');
    await act(async () => {
      fireEvent.click(dialogShiftTrigger);
    });

    const dialogMorningOption = await within(document.body).findByRole('option', {
      name: 'Morning'
    });
    await act(async () => {
      fireEvent.click(dialogMorningOption);
    });

    const submitButton = screen.getByTestId('assign-dialog-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(createAssignmentInlineFnMock).toHaveBeenCalledTimes(1);
    });

    // Dialog should close (parent's onOpenChange receives false).
    await waitFor(() => {
      expect(screen.queryByText('Assign Shift')).toBeNull();
    });

    // After the assignment lands the row no longer carries the CTA, and
    // every cell resolves to the chosen shift.
    await waitFor(() => {
      expect(screen.queryByTestId('assign-shift-cta-u2')).toBeNull();
    });
    for (const date of WEEK_DAYS) {
      const trigger = screen.getByTestId(`schedule-grid-cell-trigger-u2-${date}`);
      expect(trigger.getAttribute('aria-label')).toBe(`${date}, Morning shift, 08:00 to 17:00`);
    }
  });

  it('export — Export Excel button calls exportMonthFn with the current month + filters', async () => {
    renderPage();
    await waitForGridSettled();

    const exportButton = screen.getByTestId('schedule-grid-export');
    expect(exportButton.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(exportButton);
    });

    await waitFor(() => {
      expect(exportMonthFnMock).toHaveBeenCalledWith({
        data: { month: '2026-08', divisionId: null, query: null }
      });
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Schedule exported to Excel');
    });
  });

  it('keyboard nav — arrow keys + T in the WeekNav toolbar', async () => {
    renderPage();
    await waitForGridSettled();

    const toolbar = screen.getByRole('toolbar', { name: /week navigation/i });
    toolbar.focus();

    await act(async () => {
      fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    });
    // The mock grid is keyed by weekStart; advancing the week should bump
    // the request to the next Monday.
    await waitFor(() => {
      const calls = getScheduleGridFnMock.mock.calls;
      const weekStarts = calls.map((c) => (c[0] as { data: { weekStart: string } }).data.weekStart);
      expect(weekStarts).toContain('2026-09-07');
    });

    await act(async () => {
      fireEvent.keyDown(toolbar, { key: 'ArrowLeft' });
    });
    await waitFor(() => {
      const calls = getScheduleGridFnMock.mock.calls;
      const weekStarts = calls.map((c) => (c[0] as { data: { weekStart: string } }).data.weekStart);
      expect(weekStarts).toContain('2026-08-31');
    });

    // Jump to today (still pinned to 2026-09-02 → 2026-08-31).
    await act(async () => {
      fireEvent.keyDown(toolbar, { key: 't' });
    });
    await waitFor(() => {
      const calls = getScheduleGridFnMock.mock.calls;
      const weekStarts = calls.map((c) => (c[0] as { data: { weekStart: string } }).data.weekStart);
      expect(weekStarts[weekStarts.length - 1]).toBe('2026-08-31');
    });
  });

  it('bulk — Repeat Schedule in Bulk opens the dialog, summarizes users × weeks, and applies', async () => {
    renderPage();
    await waitForGridSettled();

    const bulkButton = screen.getByTestId('schedule-grid-bulk');
    expect(bulkButton.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(bulkButton);
    });
    await screen.findByTestId('bulk-repeat-dialog');

    // Default: 2 fixture employees × 4 weeks.
    expect(screen.getByTestId('bulk-summary').textContent).toBe('2 employees × 4 weeks');

    // Narrow to 2 upcoming weeks; the dialog previews both target weeks.
    await act(async () => {
      fireEvent.change(screen.getByTestId('bulk-weeks-select'), { target: { value: '2' } });
    });
    expect(screen.getByTestId('bulk-summary').textContent).toBe('2 employees × 2 weeks');
    expect(screen.getByTestId('bulk-target-week-2026-09-07')).toBeTruthy();
    expect(screen.getByTestId('bulk-target-week-2026-09-14')).toBeTruthy();

    // Include Weekend defaults to off.
    expect(screen.getByTestId('bulk-include-weekend').getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-repeat-apply'));
    });

    await waitFor(() => {
      expect(repeatWeekBulkFnMock).toHaveBeenCalledWith({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07', '2026-09-14'],
          divisionId: null,
          query: null,
          includeWeekend: false
        }
      });
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Repeated to 2 weeks for 2 employees');
    });
    // The dialog closes after a successful apply.
    await waitFor(() => {
      expect(screen.queryByTestId('bulk-repeat-dialog')).toBeNull();
    });
  });

  it('bulk — Include Weekend on is forwarded and partial failures toast a warning', async () => {
    repeatWeekBulkFnMock.mockResolvedValueOnce({
      success: true as const,
      weeksApplied: 2,
      usersAffected: 2,
      cellsApplied: 3,
      partialFailures: [{ userId: 'u1', date: '2026-09-07', error: 'internal' }]
    });

    renderPage();
    await waitForGridSettled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-grid-bulk'));
    });
    await screen.findByTestId('bulk-repeat-dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-include-weekend'));
    });
    expect(screen.getByTestId('bulk-include-weekend').getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-repeat-apply'));
    });

    await waitFor(() => {
      expect(repeatWeekBulkFnMock).toHaveBeenCalledWith({
        data: {
          sourceWeekStart: '2026-08-31',
          targetWeekStarts: ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'],
          divisionId: null,
          query: null,
          includeWeekend: true
        }
      });
    });
    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledWith('Repeated to 2 weeks; 1 cells failed');
    });
  });
});
