import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';

export const Route = createFileRoute('/portal/')({
  head: () => ({ meta: [{ title: 'Customer Portal' }] }),
  component: PortalIndexPage
});

function PortalIndexPage() {
  const { t } = useTranslation();
  const { portal } = Route.useRouteContext();
  if (!portal.ok) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
        <Icons.alertCircle className='size-10 text-destructive' />
        <h1 className='text-lg font-semibold'>{t('portal.blockedTitle')}</h1>
        <p className='text-muted-foreground text-sm'>{t('portal.blockedMessage')}</p>
      </div>
    );
  }
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
      <h1 className='text-lg font-semibold'>{t('portal.title')}</h1>
      <p className='text-muted-foreground text-sm'>{t('portal.subtitle')}</p>
      <p className='text-muted-foreground text-sm'>{t('portal.comingSoon')}</p>
    </div>
  );
}
