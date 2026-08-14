import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getStorageSettingsFn } from './service';

export const storageKeys = {
  all: ['storage'] as const,
  settings: () => [...storageKeys.all, 'settings'] as const
};

export const storageSettingsQueryOptions = () =>
  queryOptions({
    queryKey: storageKeys.settings(),
    queryFn: () => getStorageSettingsFn()
  });

// Hook for fetching storage settings
export function useStorageSettings() {
  return useQuery(storageSettingsQueryOptions());
}
