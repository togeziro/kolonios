import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@/features/profile/components/profile-page';

export const Route = createFileRoute('/dashboard/profile')({
  head: () => ({ meta: [{ title: 'Dashboard: Profile' }] }),
  component: () => <ProfilePage />
});
