import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { HolidayCalendarPage } from '@/features/holiday-calendar/components/holiday-calendar-page';

export const Route = createFileRoute('/dashboard/admin/holiday-calendar/')({
  component: HolidayCalendarRoute
});

function HolidayCalendarRoute() {
  return (
    <PageContainer>
      <HolidayCalendarPage />
    </PageContainer>
  );
}
