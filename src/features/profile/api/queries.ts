import { queryOptions } from '@tanstack/react-query';
import { getObjectUrlFn } from '@/features/storage/api/service';

export const profileKeys = {
  all: ['profile'] as const,
  avatar: (key: string) => [...profileKeys.all, 'avatar', key] as const
};

// TODO(wire): resolves user.image object keys through the existing storage
// presign path; swap to a dedicated avatars folder/presign scope once the
// backend provides one.
export const avatarUrlQueryOptions = (key: string) =>
  queryOptions({
    queryKey: profileKeys.avatar(key),
    queryFn: () => getObjectUrlFn({ data: { key } }),
    retry: false,
    staleTime: 5 * 60 * 1000
  });
