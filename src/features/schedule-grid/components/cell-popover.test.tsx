// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n/config';

vi.mock('../api/shifts-queries', () => ({
  useEligibleShiftsForDay: vi.fn()
}));

vi.mock('../api/write-mutations', () => ({
  useApplyToWholeWeek: vi.fn(),
  useClearCell: vi.fn(),
  useDeleteAssignment: vi.fn(),
  useSetCellDayOff: vi.fn(),
  useSetCellShift: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/hooks/use-nav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-nav')>();
  return {
    ...actual,
    useRoleGroupPermissions: () => ({ isAdmin: true, permissions: {} })
  };
});

import { CellPopover } from './cell-popover';
import { useEligibleShiftsForDay } from '../api/shifts-queries';
import {
  useApplyToWholeWeek,
  useClearCell,
  useDeleteAssignment,
  useSetCellDayOff,
  useSetCellShift
} from '../api/write-mutations';
import type { ScheduleGridCell } from '../api/types';

function makeCell(overrides: Partial<ScheduleGridCell> = {}): ScheduleGridCell {
  return {
    date: '2026-08-05',
    shiftId: 1,
    shiftName: 'Morning',
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 5,
    absenceCutoffMinutes: 120,
    isDayOff: false,
    hasAssignment: true,
    hasOverride: false,
    assignmentId: 1,
    assignmentFrom: '2026-08-01',
    assignmentTo: '2026-08-31',
    isHoliday: false,
    holidayName: null,
    holidayOverUnassigned: false,
    dayOffReason: null,
    policyMissing: false,
    ...overrides
  };
}

const shiftsMock = useEligibleShiftsForDay as unknown as ReturnType<typeof vi.fn>;
const setShiftMock = useSetCellShift as unknown as ReturnType<typeof vi.fn>;
const setDayOffMock = useSetCellDayOff as unknown as ReturnType<typeof vi.fn>;
const clearMock = useClearCell as unknown as ReturnType<typeof vi.fn>;
const deleteAssignmentMock = useDeleteAssignment as unknown as ReturnType<typeof vi.fn>;
const applyWeekMock = useApplyToWholeWeek as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  shiftsMock.mockReturnValue({
    data: [
      {
        shiftId: 1,
        shiftName: 'Morning',
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 5,
        absenceCutoffMinutes: 120
      }
    ],
    isLoading: false
  });
  setShiftMock.mockReturnValue(mutStub());
  setDayOffMock.mockReturnValue(mutStub());
  clearMock.mockReturnValue(mutStub());
  deleteAssignmentMock.mockReturnValue(mutStub());
  applyWeekMock.mockReturnValue(mutStub());
});

function mutStub() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({
      success: true,
      cell: makeCell(),
      affectedUserId: 'u1',
      affectedDates: ['2026-08-05']
    }),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    reset: vi.fn()
  };
}

function withQueryClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, node);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('CellPopover', () => {
  it('renders the trigger button and opens the popover on click', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell(),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    const trigger = screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05');
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('schedule-grid-cell-popover-u1-2026-08-05')).toBeInTheDocument();
    });
  });

  it('shows the policy-missing warning when cell.policyMissing is true', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ policyMissing: true }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('policy-missing-warning')).toBeInTheDocument();
    });
  });

  it('shows the day-off conflict UX when cell.isDayOff is true', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ isDayOff: true }),
          children: createElement('span', null, 'Day Off')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('day-off-conflict-warning')).toBeInTheDocument();
    });
  });

  it('shows the orphan day-off note when cell.isDayOff is true', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ isDayOff: true }),
          children: createElement('span', null, 'Day Off')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-day-off-note')).toBeInTheDocument();
    });
  });

  it('invokes setCellShiftFn on save when a shift is selected', async () => {
    const user = userEvent.setup();
    const mut = mutStub();
    setShiftMock.mockReturnValue(mut);

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell(),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('popover-save-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('popover-save-button'));

    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      date: '2026-08-05',
      shiftId: 1
    });
  });

  it('threads the day-off reason to setCellDayOffFn when saving', async () => {
    const user = userEvent.setup();
    const mut = mutStub();
    setDayOffMock.mockReturnValue(mut);

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ isDayOff: false, shiftId: null }),
          children: createElement('span', null, '—')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('day-off-switch')).toBeInTheDocument();
    });

    // Toggle the day-off switch and type a reason.
    await user.click(screen.getByTestId('day-off-switch'));

    const reasonInput = screen.getByTestId('day-off-reason-input') as HTMLInputElement;
    await user.clear(reasonInput);
    await user.type(reasonInput, 'Family event');

    await user.click(screen.getByTestId('popover-save-button'));

    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      date: '2026-08-05',
      reason: 'Family event'
    });
  });

  it('shows the bulk-partial toast when apply-to-week has partial failures', async () => {
    const user = userEvent.setup();
    const mut = mutStub();
    mut.mutateAsync.mockResolvedValue({
      success: true,
      daysApplied: 4,
      partialFailures: [
        { date: '2026-08-08', error: 'internal' },
        { date: '2026-08-09', error: 'internal' }
      ],
      affectedUserId: 'u1',
      affectedDates: ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']
    });
    applyWeekMock.mockReturnValue(mut);

    const { toast } = await import('sonner');

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell(),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('apply-to-week-switch')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('apply-to-week-switch'));

    await user.click(screen.getByTestId('popover-save-button'));

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/Applied to 4 days.*2 failed/i)
    );
  });

  it('anchors "Apply to all 7 days" to the displayed Monday-start week, not the Sunday-start window', async () => {
    const user = userEvent.setup();
    // Regression test (issue 03 observed): the popover used to anchor
    // `cell.date − dow` (Sunday-start), so on a Monday-start grid it wrote
    // Sun-1wk…Sat and missed the visible Sunday. With `weekStart` (the
    // displayed week's anchor, threaded from ScheduleGrid → GridCell) it
    // must write exactly Mon…Sun of the visible week.
    const mut = mutStub();
    mut.mutateAsync.mockResolvedValue({
      success: true,
      daysApplied: 7,
      partialFailures: [],
      affectedUserId: 'u1',
      affectedDates: [
        '2026-08-31',
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06'
      ]
    });
    applyWeekMock.mockReturnValue(mut);

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          // Wednesday inside the Monday-start week 2026-08-31…2026-09-06.
          cell: makeCell({ date: '2026-09-02' }),
          weekStart: '2026-08-31',
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-09-02'));

    await waitFor(() => {
      expect(screen.getByTestId('apply-to-week-switch')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('apply-to-week-switch'));

    await user.click(screen.getByTestId('popover-save-button'));

    // Sunday-start anchor would have been 2026-08-30 (missing visible Sun 09-06).
    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      weekStart: '2026-08-31',
      mode: 'shift',
      shiftId: 1,
      includeWeekend: true
    });
  });

  it('hides Clear for an assignment-backed shift and offers Delete schedule instead', async () => {
    const user = userEvent.setup();
    // Regression test: the Clear button used to be gated on `cell.shiftId != null`,
    // which the resolver also stamps from the covering assignment. Clear only
    // deletes `date_overrides` / `day_offs`, so it reported success while the
    // schedule stayed put.
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ shiftId: 1, hasOverride: false, isDayOff: false, assignmentId: 7 }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-assignment-button')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('clear-cell-footer-button')).not.toBeInTheDocument();
  });

  it('shows Clear when the cell owns a date override', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ shiftId: 1, hasOverride: true, isDayOff: false, assignmentId: 7 }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('clear-cell-footer-button')).toBeInTheDocument();
    });
    // The assignment is still behind the override, so it can also be deleted.
    expect(screen.getByTestId('delete-assignment-button')).toBeInTheDocument();
  });

  it('offers no Delete schedule when the cell has no assignment', async () => {
    const user = userEvent.setup();
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({
            shiftId: null,
            shiftName: null,
            startTime: null,
            endTime: null,
            hasAssignment: false,
            assignmentId: null,
            assignmentFrom: null,
            assignmentTo: null,
            isDayOff: true
          }),
          children: createElement('span', null, 'Day Off')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('day-off-conflict-warning')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('delete-assignment-button')).not.toBeInTheDocument();
  });

  it('deletes the resolved assignment after confirming', async () => {
    const user = userEvent.setup();
    const mut = mutStub();
    deleteAssignmentMock.mockReturnValue(mut);

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ assignmentId: 42 }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-assignment-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-assignment-button'));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete schedule' }));

    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      date: '2026-08-05',
      assignmentId: 42
    });
  });

  it('treats an already-deleted assignment as a no-op, not a failure', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    const mut = mutStub();
    mut.mutateAsync.mockResolvedValue({ success: false, error: 'notFound' });
    deleteAssignmentMock.mockReturnValue(mut);

    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ assignmentId: 42 }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await user.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-assignment-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('delete-assignment-button'));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete schedule' }));

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
