import { createFileRoute } from '@tanstack/react-router';
import ChangePasswordPage from '@/features/profile/components/change-password-page';

export const Route = createFileRoute('/dashboard/change-password')({
  head: () => ({ meta: [{ title: 'Dashboard: Change Password' }] }),
  component: () => <ChangePasswordPage />
});
