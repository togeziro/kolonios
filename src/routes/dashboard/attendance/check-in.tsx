import { createFileRoute } from '@tanstack/react-router';

import { CheckInPage } from '@/features/attendance/components/check-in-page';

export const Route = createFileRoute('/dashboard/attendance/check-in')({
  component: CheckInPage
});
