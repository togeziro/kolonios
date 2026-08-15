import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import AchievementsPage from '@/features/achievements/components/achievements-page';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/achievements')({
  head: () => ({ meta: [{ title: 'Dashboard: Achievements' }] }),
  component: AchievementsDashboardPage
});

function AchievementsDashboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('achievements.pageTitle')}
      pageDescription={t('achievements.pageDescription')}
    >
      <AchievementsPage />
    </PageContainer>
  );
}
