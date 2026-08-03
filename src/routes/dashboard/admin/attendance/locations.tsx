import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { LocationManagePage } from '@/features/attendance/components/location-manage-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/attendance/locations')({
  head: () => ({ meta: [{ title: 'Dashboard: Attendance Locations' }] }),
  component: LocationsPage
});

function LocationsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('attendanceAdmin.locationsTitle')}
      pageDescription={t('attendanceAdmin.locationsDescription')}
    >
      <LocationManagePage />
    </PageContainer>
  );
}
