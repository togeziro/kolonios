import { createFileRoute } from '@tanstack/react-router';
import { HolidayCalendarPage } from '@/features/holiday-calendar/components/holiday-calendar-page';

export const Route = createFileRoute('/dashboard/admin/holiday-calendar/')({
  component: HolidayCalendarPage
});
