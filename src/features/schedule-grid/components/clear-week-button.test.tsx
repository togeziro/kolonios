// @vitest-environment jsdom
/**
 * Component tests for the row-header "Clear week" action (rendered through
 * `GridRowHeader`, which is its real mount point).
 *
 * The action is destructive, so the contract under test is:
 *   - the button only appears when the visible week has something clearable
 *     (never a button that does nothing);
 *   - opening it shows the shared `ConfirmDialog` naming the employee and
 *     the exact date range being cleared;
 *   - confirming calls the mutation with `{ userId, weekStart }`;
 *   - cancelling does not.
 *
 * Mutation + toast modules are mocked (mirrors `cell-popover.test.tsx`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import '@/i18n/config';

vi.mock('../api/write-mutations', () => ({
  useClearWeek: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

// Mutable role permissions so most tests run as an admin (button visible)
// while one test asserts the button hides without `attendance_admin.delete`.
const rolePerms = vi.hoisted(() => ({
  value: {
    isAdmin: true,
    permissions: {} as import('@/features/role-groups/api/types').Permissions
  }
}));

vi.mock('@/hooks/use-nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-nav')>();
  return {
    ...actual,
    useRoleGroupPermissions: () => rolePerms.value
  };
});

import { GridRowHeader } from './grid-row-header';
import { useClearWeek } from '../api/write-mutations';
import type { ScheduleGridCell, ScheduleGridRow } from '../api/types';

const WEEK_START = '2026-08-31';
const WEEK_END = '2026-09-06';
const WEEK_DAYS = [
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
  '2026-09-06'
];

const clearWeekMock = useClearWeek as unknown as ReturnType<typeof vi.fn>;

function emptyCell(date: string, overrides: Partial<ScheduleGridCell> = {}): ScheduleGridCell {
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
    hasOverride: false,
    assignmentId: null,
    assignmentFrom: null,
    assignmentTo: null,
    isHoliday: false,
    holidayName: null,
    holidayOverUnassigned: false,
    dayOffReason: null,
    policyMissing: false,
    ...overrides
  };
}

function makeRow(overrides: Partial<ScheduleGridRow> = {}): ScheduleGridRow {
  return {
    userId: 'u1',
    fullName: 'Aldi Pranata',
    employeeCode: 'EMP-0001',
    divisionId: 2,
    divisionName: 'Engineering',
    activeShiftName: null,
    hasAssignment: false,
    cells: WEEK_DAYS.map((date) => emptyCell(date)),
    ...overrides
  };
}

function mutStub(result: unknown) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(result),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    reset: vi.fn()
  };
}

function renderHeader(row: ScheduleGridRow) {
  render(createElement(GridRowHeader, { row, weekStart: WEEK_START }));
}

beforeEach(() => {
  rolePerms.value = { isAdmin: true, permissions: {} };
  clearWeekMock.mockReturnValue(
    mutStub({
      success: true,
      affectedUserId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      deletedAssignments: 1,
      trimmedAssignments: 0,
      splitAssignments: 0,
      clearedOverrides: 0,
      clearedDayOffs: 0,
      totalCleared: 1
    })
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GridRowHeader — Clear week', () => {
  it('renders the clear-week button when the week has clearable rows', () => {
    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    expect(screen.getByTestId('clear-week-button-u1')).toBeTruthy();
  });

  it('renders the button for an orphan day off (no assignment behind it)', () => {
    renderHeader(
      makeRow({
        cells: WEEK_DAYS.map((date) =>
          date === '2026-09-02' ? emptyCell(date, { isDayOff: true }) : emptyCell(date)
        )
      })
    );

    expect(screen.getByTestId('clear-week-button-u1')).toBeTruthy();
  });

  it('renders the button for a lone date override', () => {
    renderHeader(
      makeRow({
        cells: WEEK_DAYS.map((date) =>
          date === '2026-09-03'
            ? emptyCell(date, { hasOverride: true, shiftId: 1 })
            : emptyCell(date)
        )
      })
    );

    expect(screen.getByTestId('clear-week-button-u1')).toBeTruthy();
  });

  it('hides the button when the week has nothing clearable', () => {
    renderHeader(makeRow());

    expect(screen.queryByTestId('clear-week-button-u1')).toBeNull();
  });

  it('hides the button for a role without attendance_admin.delete', () => {
    rolePerms.value = { isAdmin: false, permissions: { attendance_admin: { view: true } } };
    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    expect(screen.queryByTestId('clear-week-button-u1')).toBeNull();
  });

  it('opens the confirm dialog naming the employee and the exact week range', async () => {
    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-week-button-u1'));
    });

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getAllByText(/Aldi Pranata/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(new RegExp(`${WEEK_START}.*${WEEK_END}`))).toBeTruthy();
  });

  it('calls the clear-week mutation with the userId and weekStart on confirm', async () => {
    const mut = mutStub({
      success: true,
      affectedUserId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      deletedAssignments: 1,
      trimmedAssignments: 0,
      splitAssignments: 0,
      clearedOverrides: 0,
      clearedDayOffs: 0,
      totalCleared: 1
    });
    clearWeekMock.mockReturnValue(mut);

    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-week-button-u1'));
    });
    const dialog = await screen.findByRole('alertdialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear week' }));
    });

    expect(mut.mutateAsync).toHaveBeenCalledWith({ userId: 'u1', weekStart: WEEK_START });
  });

  it('does not call the mutation when the dialog is cancelled', async () => {
    const mut = mutStub({ success: true });
    clearWeekMock.mockReturnValue(mut);

    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-week-button-u1'));
    });
    const dialog = await screen.findByRole('alertdialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    });

    expect(mut.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows an info toast, not an error, when there was nothing to clear', async () => {
    const { toast } = await import('sonner');
    const mut = mutStub({
      success: true,
      affectedUserId: 'u1',
      weekStart: WEEK_START,
      weekEnd: WEEK_END,
      deletedAssignments: 0,
      trimmedAssignments: 0,
      splitAssignments: 0,
      clearedOverrides: 0,
      clearedDayOffs: 0,
      totalCleared: 0
    });
    clearWeekMock.mockReturnValue(mut);

    renderHeader(
      makeRow({
        hasAssignment: true,
        cells: WEEK_DAYS.map((date) => emptyCell(date, { hasAssignment: true }))
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-week-button-u1'));
    });
    const dialog = await screen.findByRole('alertdialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Clear week' }));
    });

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
