import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { StorageSettings } from '@/features/storage/components/storage-settings';

export const Route = createFileRoute('/dashboard/admin/storage-settings')({
  component: StorageSettingsPage
});

function StorageSettingsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer pageTitle={t('storage.title')} pageDescription={t('storage.description')}>
      <div className='max-w-3xl'>
        <StorageSettings />
      </div>
    </PageContainer>
  );
}
