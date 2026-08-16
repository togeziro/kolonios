import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getWorklogSettingsFn } from './service';

export const worklogSettingsKeys = {
  all: ['worklog-settings'] as const,
  policy: () => [...worklogSettingsKeys.all, 'policy'] as const
};

export const worklogSettingsQueryOptions = () =>
  queryOptions({
    queryKey: worklogSettingsKeys.policy(),
    queryFn: () => getWorklogSettingsFn()
  });

export function useWorklogSettings() {
  return useQuery(worklogSettingsQueryOptions());
}
