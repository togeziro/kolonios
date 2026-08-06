import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { HolidayCalendarPage } from '@/features/holiday-calendar/components/holiday-calendar-page';

export const Route = createFileRoute('/dashboard/admin/holiday-calendar/')({
  component: HolidayCalendarRoute
});

function HolidayCalendarRoute() {
  const { t } = useTranslation();

  return (
    <PageContainer pageTitle={t('holiday.title')} pageDescription={t('holiday.description')}>
      <HolidayCalendarPage />
    </PageContainer>
  );
}
