import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/admin/broadcast')({
  head: () => ({ meta: [{ title: 'Dashboard: Broadcast' }] }),
  component: BroadcastRoute
});

function BroadcastRoute() {
  const { t } = useTranslation();
  return (
    <PageContainer
      pageTitle={t('broadcast.pageTitle')}
      pageDescription={t('broadcast.pageDescription')}
    >
      <Card className='mx-auto w-full max-w-2xl'>
        <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
          <Icons.send className='mb-4 h-12 w-12 text-muted-foreground/50' />
          <h3 className='mb-1 text-lg font-semibold'>{t('broadcast.comingSoon')}</h3>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
