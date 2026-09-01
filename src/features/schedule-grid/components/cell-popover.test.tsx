// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n/config';

vi.mock('../api/shifts-queries', () => ({
  useEligibleShiftsForDay: vi.fn()
}));

vi.mock('../api/write-mutations', () => ({
  useApplyToWholeWeek: vi.fn(),
  useClearCell: vi.fn(),
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

import { CellPopover } from './cell-popover';
import { useEligibleShiftsForDay } from '../api/shifts-queries';
import {
  useApplyToWholeWeek,
  useClearCell,
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
    expect(trigger).toBeTruthy();

    await act(async () => {
      fireEvent.click(trigger);
    });

    await waitFor(() => {
      expect(screen.getByTestId('schedule-grid-cell-popover-u1-2026-08-05')).toBeTruthy();
    });
  });

  it('shows the policy-missing warning when cell.policyMissing is true', async () => {
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ policyMissing: true }),
          children: createElement('span', null, 'Morning')
        })
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('policy-missing-warning')).toBeTruthy();
    });
  });

  it('shows the day-off conflict UX when cell.isDayOff is true', async () => {
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ isDayOff: true }),
          children: createElement('span', null, 'Day Off')
        })
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('day-off-conflict-warning')).toBeTruthy();
    });
  });

  it('shows the orphan day-off note when cell.isDayOff is true', async () => {
    render(
      withQueryClient(
        createElement(CellPopover, {
          employeeId: 'u1',
          cell: makeCell({ isDayOff: true }),
          children: createElement('span', null, 'Day Off')
        })
      )
    );

    fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-day-off-note')).toBeTruthy();
    });
  });

  it('invokes setCellShiftFn on save when a shift is selected', async () => {
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

    fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('popover-save-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('popover-save-button'));
    });

    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      date: '2026-08-05',
      shiftId: 1
    });
  });

  it('threads the day-off reason to setCellDayOffFn when saving', async () => {
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

    fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('day-off-switch')).toBeTruthy();
    });

    // Toggle the day-off switch and type a reason.
    await act(async () => {
      fireEvent.click(screen.getByTestId('day-off-switch'));
    });

    const reasonInput = screen.getByTestId('day-off-reason-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(reasonInput, { target: { value: 'Family event' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('popover-save-button'));
    });

    expect(mut.mutateAsync).toHaveBeenCalledWith({
      userId: 'u1',
      date: '2026-08-05',
      reason: 'Family event'
    });
  });

  it('shows the bulk-partial toast when apply-to-week has partial failures', async () => {
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

    fireEvent.click(screen.getByTestId('schedule-grid-cell-trigger-u1-2026-08-05'));

    await waitFor(() => {
      expect(screen.getByTestId('apply-to-week-switch')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('apply-to-week-switch'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('popover-save-button'));
    });

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/Applied to 4 days.*2 failed/i)
    );
  });
});
