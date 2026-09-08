import { queryOptions } from '@tanstack/react-query';
import { getObjectUrlFn } from '@/features/storage/api/service';
import { getMyEmployeeFn } from './service';

export const profileKeys = {
  all: ['profile'] as const,
  avatar: (key: string) => [...profileKeys.all, 'avatar', key] as const,
  workInfo: ['profile', 'work-info'] as const
};

// Avatars are stored under the dedicated `avatars/` folder (owner-scoped
// presign scope) and resolved here through the generic presign GET path.
export const avatarUrlQueryOptions = (key: string) =>
  queryOptions({
    queryKey: profileKeys.avatar(key),
    queryFn: () => getObjectUrlFn({ data: { key } }),
    retry: false,
    staleTime: 5 * 60 * 1000
  });

export const myWorkInfoQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.workInfo,
    queryFn: () => getMyEmployeeFn(),
    retry: false,
    staleTime: 5 * 60 * 1000
  });
