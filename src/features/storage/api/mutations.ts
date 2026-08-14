import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStorageSettingsFn } from './service';
import { storageKeys } from './queries';

export function useUpdateStorageSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof updateStorageSettingsFn>[0]['data']) =>
      updateStorageSettingsFn({ data }),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: storageKeys.settings() });
    }
  });
}
