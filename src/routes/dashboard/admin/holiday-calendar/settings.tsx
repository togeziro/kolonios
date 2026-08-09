import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { CompanyLocaleSettings } from '@/features/holiday-calendar/components/company-locale-settings';
import { HolidayApiSettings } from '@/features/holiday-calendar/components/holiday-api-settings';

export const Route = createFileRoute('/dashboard/admin/holiday-calendar/settings')({
  component: HolidaySettingsPage
});

function HolidaySettingsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer
      pageTitle={t('holiday.settings')}
      pageDescription={t('holiday.settingsDescription')}
    >
      <div className='max-w-3xl'>
        <HolidayApiSettings />
        <CompanyLocaleSettings />
      </div>
    </PageContainer>
  );
}
