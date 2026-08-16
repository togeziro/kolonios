import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setWorklogSettingsFn } from './service';
import { worklogSettingsKeys } from './queries';

export function useSetWorklogSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { lenient: boolean }) => setWorklogSettingsFn({ data }),
    onSuccess: (result) => {
      queryClient.setQueryData(worklogSettingsKeys.policy(), result);
    }
  });
}
