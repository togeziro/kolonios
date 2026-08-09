import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_LOCALE, type AppLocale } from '@/lib/locale/types';
import { getAppLocaleFn, updateAppLocaleFn } from './service';

export const appLocaleQueryOptions = () =>
  queryOptions({
    queryKey: ['settings', 'locale'],
    queryFn: () => getAppLocaleFn(),
    staleTime: Infinity
  });

export function useAppLocale(): AppLocale {
  const { data } = useQuery(appLocaleQueryOptions());
  return data?.locale ?? DEFAULT_LOCALE;
}

export function useUpdateAppLocale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: AppLocale) => updateAppLocaleFn({ data: { locale } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'locale'] })
  });
}
