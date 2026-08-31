import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBrandingSettingsFn } from './service';
import type { UpdateBrandingInput } from './validation';
import { PUBLIC_BRANDING_KEY } from './public-queries';
import { brandingKeys } from './queries';

export function useUpdateBrandingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBrandingInput) => updateBrandingSettingsFn({ data }),
    onSuccess: (result) => {
      queryClient.setQueryData(brandingKeys.settings(), result);
      // Shells and the login page read the public branding query; keep them
      // fresh so saved branding shows up without waiting out staleTime.
      queryClient.invalidateQueries({ queryKey: PUBLIC_BRANDING_KEY });
    }
  });
}
