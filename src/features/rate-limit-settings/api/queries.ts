import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getRateLimitSettingsFn } from './service';

export const rateLimitSettingsKeys = {
  all: ['rate-limit-settings'] as const,
  policy: () => [...rateLimitSettingsKeys.all, 'policy'] as const
};

export const rateLimitSettingsQueryOptions = () =>
  queryOptions({
    queryKey: rateLimitSettingsKeys.policy(),
    queryFn: () => getRateLimitSettingsFn()
  });

export function useRateLimitSettings() {
  return useQuery(rateLimitSettingsQueryOptions());
}
