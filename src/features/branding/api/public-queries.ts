import { queryOptions, useQuery } from '@tanstack/react-query';

export const PUBLIC_BRANDING_KEY = ['branding', 'public'] as const;

const publicBrandingQueryOptions = () =>
  queryOptions({
    queryKey: PUBLIC_BRANDING_KEY,
    queryFn: async () => {
      const { getPublicBrandingFn } = await import('../api/service');
      return getPublicBrandingFn();
    },
    staleTime: 5 * 60 * 1000
  });

export function usePublicBranding() {
  return useQuery(publicBrandingQueryOptions());
}
