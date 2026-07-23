import { createFileRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import NotificationsPage from '@/features/notifications/components/notifications-page';
import { notificationListQueryOptions } from '@/features/notifications/api/queries';

export const Route = createFileRoute('/dashboard/notifications')({
  head: () => ({ meta: [{ title: 'Dashboard: Notifications' }] }),
  ssr: 'data-only',
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(notificationListQueryOptions());
  },
  component: () => <NotificationsPage />
});
