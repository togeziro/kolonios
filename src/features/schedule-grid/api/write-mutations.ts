/**
 * React Query factories for the write-side schedule grid (ticket 02).
 *
 * The popover composes `setCellShiftMutation`, `setCellDayOffMutation`,
 * `clearCellMutation`, and `applyToWholeWeekMutation`. Each wraps the
 * corresponding server fn in a `useMutation` hook with the repo-standard
 * `mergeMutationCallbacks` pattern (`src/lib/mutation-options.ts:8-34`)
 * for cache invalidation across the `scheduleGridKeys` namespace AND the
 * cross-feature `attendanceKeys.effectiveSchedule` / `attendanceKeys.assignments`
 * keys (imported per ADR-0001's cross-feature allowance).
 */

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';

import { attendanceKeys } from '@/features/attendance/api/queries';

import {
  applyToWholeWeekFn,
  clearCellFn,
  setCellDayOffFn,
  setCellShiftFn,
  type CellWriteResult
} from './write-service';
import { scheduleGridKeys } from './queries';

export type SetCellShiftInput = {
  userId: string;
  date: string;
  shiftId: number;
};

export type SetCellDayOffInput = {
  userId: string;
  date: string;
};

export type ClearCellInput = {
  userId: string;
  date: string;
};

export type ApplyToWholeWeekInput = {
  userId: string;
  weekStart: string;
  mode: 'shift' | 'dayOff';
  shiftId?: number;
  includeWeekend: boolean;
};

export type ApplyToWholeWeekResult =
  | {
      success: true;
      daysApplied: number;
      partialFailures: Array<{ date: string; error: string }>;
      affectedUserId: string;
      affectedDates: string[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * Invalidate the schedule-grid + cross-feature caches for a write. Used by
 * every mutation below (both on success and on error). Centralizing keeps
 * the rollback / settled behavior identical to `getScheduleGridFn`'s shape.
 */
function invalidateScheduleGridCaches(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: scheduleGridKeys.all });
  queryClient.invalidateQueries({ queryKey: attendanceKeys.effectiveSchedule() });
  queryClient.invalidateQueries({ queryKey: attendanceKeys.assignments({} as never) });
  queryClient.invalidateQueries({ queryKey: attendanceKeys.dayOffs() });
}

export function setCellShiftMutation(
  queryClient: ReturnType<typeof useQueryClient>
): UseMutationOptions<CellWriteResult, Error, SetCellShiftInput> {
  return {
    mutationFn: async (input) => setCellShiftFn({ data: input }),
    onSettled: () => invalidateScheduleGridCaches(queryClient)
  };
}

export function setCellDayOffMutation(
  queryClient: ReturnType<typeof useQueryClient>
): UseMutationOptions<CellWriteResult, Error, SetCellDayOffInput> {
  return {
    mutationFn: async (input) => setCellDayOffFn({ data: input }),
    onSettled: () => invalidateScheduleGridCaches(queryClient)
  };
}

export function clearCellMutation(
  queryClient: ReturnType<typeof useQueryClient>
): UseMutationOptions<CellWriteResult, Error, ClearCellInput> {
  return {
    mutationFn: async (input) => clearCellFn({ data: input }),
    onSettled: () => invalidateScheduleGridCaches(queryClient)
  };
}

export function applyToWholeWeekMutation(
  queryClient: ReturnType<typeof useQueryClient>
): UseMutationOptions<ApplyToWholeWeekResult, Error, ApplyToWholeWeekInput> {
  return {
    mutationFn: async (input) => applyToWholeWeekFn({ data: input }),
    onSettled: () => invalidateScheduleGridCaches(queryClient)
  };
}

// Re-export the typed hook factories — the popover imports these and
// composes with `mergeMutationCallbacks` per repo convention.
export function useSetCellShift() {
  const queryClient = useQueryClient();
  return useMutation(setCellShiftMutation(queryClient));
}

export function useSetCellDayOff() {
  const queryClient = useQueryClient();
  return useMutation(setCellDayOffMutation(queryClient));
}

export function useClearCell() {
  const queryClient = useQueryClient();
  return useMutation(clearCellMutation(queryClient));
}

export function useApplyToWholeWeek() {
  const queryClient = useQueryClient();
  return useMutation(applyToWholeWeekMutation(queryClient));
}
