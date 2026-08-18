import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { FaceSettings } from '@/features/attendance/components/face-settings';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/attendance/face-settings')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'attendance.edit' });
  },
  component: AdminFaceSettingsPage
});

function AdminFaceSettingsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer pageTitle={t('faceSettings.title')} pageDescription={t('faceSettings.subtitle')}>
      <div className='grid max-w-xl gap-4'>
        <FaceSettings />
      </div>
    </PageContainer>
  );
}
