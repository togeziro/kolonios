import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRateLimitSettingsFn, resetRateLimitSettingsFn } from './service';
import { rateLimitSettingsKeys } from './queries';
import type { RateLimitInput } from './validation';

export function useUpdateRateLimitSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RateLimitInput) => updateRateLimitSettingsFn({ data }),
    onSuccess: (result) => {
      queryClient.setQueryData(rateLimitSettingsKeys.policy(), result);
    }
  });
}

export function useResetRateLimitSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resetRateLimitSettingsFn(),
    onSuccess: (result) => {
      queryClient.setQueryData(rateLimitSettingsKeys.policy(), result);
    }
  });
}
