import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createNationalHolidayFn,
  updateNationalHolidayFn,
  deleteNationalHolidayFn,
  importHolidaysFromApiFn
} from './service';
import { holidayKeys } from './queries';

export function useCreateNationalHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof createNationalHolidayFn>[0]['data']) =>
      createNationalHolidayFn({ data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: holidayKeys.lists() });
    }
  });
}

export function useUpdateNationalHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof updateNationalHolidayFn>[0]['data']) =>
      updateNationalHolidayFn({ data }),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: holidayKeys.lists() });
      if (result.success && result.holiday) {
        queryClient.invalidateQueries({ queryKey: holidayKeys.detail(result.holiday.id) });
      }
    }
  });
}

export function useDeleteNationalHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof deleteNationalHolidayFn>[0]['data']) =>
      deleteNationalHolidayFn({ data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: holidayKeys.lists() });
    }
  });
}

export function useImportHolidaysFromApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof importHolidaysFromApiFn>[0]['data']) =>
      importHolidaysFromApiFn({ data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: holidayKeys.lists() });
    }
  });
}
