import { createFileRoute } from '@tanstack/react-router';
import EditProfilePage from '@/features/profile/components/edit-profile-page';

export const Route = createFileRoute('/dashboard/edit-profile')({
  head: () => ({ meta: [{ title: 'Dashboard: Edit Profile' }] }),
  component: () => <EditProfilePage />
});
