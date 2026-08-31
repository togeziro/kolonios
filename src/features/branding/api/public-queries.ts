import { queryOptions, useQuery } from '@tanstack/react-query';

export interface PublicBranding {
  logoLight: string | null;
  logoDark: string | null;
  name: string | null;
}

export const PUBLIC_BRANDING_KEY = ['branding', 'public'] as const;

export const publicBrandingQueryOptions = () =>
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
