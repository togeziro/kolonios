import { queryOptions } from '@tanstack/react-query';
import { getBrandingSettingsFn } from './service';

export const brandingKeys = {
  all: ['branding'] as const,
  settings: () => [...brandingKeys.all, 'settings'] as const
};

export const brandingSettingsQueryOptions = () =>
  queryOptions({
    queryKey: brandingKeys.settings(),
    queryFn: () => getBrandingSettingsFn()
  });
