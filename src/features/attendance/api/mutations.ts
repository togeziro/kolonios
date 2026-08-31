import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createShiftFn, updateShiftFn, deleteShiftFn } from './service';
import { attendanceKeys } from './queries';

type ShiftCreateInput = Parameters<typeof createShiftFn>[0]['data'];
type ShiftUpdateInput = Parameters<typeof updateShiftFn>[0]['data'];
type ShiftDeleteInput = Parameters<typeof deleteShiftFn>[0]['data'];

function invalidateShiftQueries() {
  const qc = getQueryClient();
  qc.invalidateQueries({ queryKey: attendanceKeys.shiftsList() });
  qc.invalidateQueries({ queryKey: attendanceKeys.shifts() });
  qc.invalidateQueries({ queryKey: attendanceKeys.schedules() });
}

export const createShiftMutation = mutationOptions({
  mutationFn: (data: ShiftCreateInput) => createShiftFn({ data }),
  onSuccess: invalidateShiftQueries
});

export const updateShiftMutation = mutationOptions({
  mutationFn: (data: ShiftUpdateInput) => updateShiftFn({ data }),
  onSuccess: invalidateShiftQueries
});

export const deleteShiftMutation = mutationOptions({
  mutationFn: (data: ShiftDeleteInput) => deleteShiftFn({ data }),
  onSuccess: invalidateShiftQueries
});

export type { ShiftCreateInput, ShiftUpdateInput, ShiftDeleteInput };
