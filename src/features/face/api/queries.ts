import { queryOptions } from '@tanstack/react-query';
import { getMyFaceEnrollmentFn, getFaceSettingsFn } from './service';

export const faceKeys = {
  all: ['face'] as const,
  enrollment: () => [...faceKeys.all, 'enrollment'] as const,
  settings: () => [...faceKeys.all, 'settings'] as const
};

export const myFaceEnrollmentQueryOptions = () =>
  queryOptions({
    queryKey: faceKeys.enrollment(),
    queryFn: () => getMyFaceEnrollmentFn()
  });

export const faceSettingsQueryOptions = () =>
  queryOptions({
    queryKey: faceKeys.settings(),
    queryFn: () => getFaceSettingsFn()
  });
