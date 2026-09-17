import { queryOptions, useQuery } from '@tanstack/react-query';

export const PUBLIC_BRANDING_KEY = ['branding', 'public'] as const;

// Exported so route loaders can SSR-seed branding via
// `queryClient.ensureQueryData(publicBrandingQueryOptions())` — without it
// the first paint (SSR + pre-hydration) renders the `auth.brand` fallback
// and flashes over to the real company name once the client query lands.
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
