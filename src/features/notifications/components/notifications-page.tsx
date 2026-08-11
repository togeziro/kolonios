import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notificationListQueryOptions } from '../api/queries';
import { markAsReadMutation, markAllAsReadMutation } from '../api/mutations';
import { useTranslation } from 'react-i18next';

const actionRoutes: Record<string, string> = {
  view: '/dashboard/overview',
  billing: '/dashboard/overview',
  open: '/dashboard/overview'
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { data } = useQuery(notificationListQueryOptions());
  const notifications = data ?? [];
  const { mutate: markAsRead } = useMutation(markAsReadMutation);
  const { mutate: markAllAsRead } = useMutation(markAllAsReadMutation);
  const router = useRouter();
  const count = notifications.filter((n) => n.status === 'unread').length;

  const unreadNotifications = notifications.filter((n) => n.status === 'unread');
  const readNotifications = notifications.filter((n) => n.status === 'read');

  const renderList = (items: typeof notifications) => {
    if (items.length === 0) {
      return (
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>{t('notifications.noNotificationsPage')}</p>
        </div>
      );
    }

    return (
      <div className='flex flex-col gap-2'>
        {items.map((notification) => (
          <NotificationCard
            key={notification.id}
            id={notification.id}
            title={notification.title}
            body={notification.body}
            status={notification.status}
            createdAt={notification.createdAt}
            actions={notification.actions}
            onMarkAsRead={(id) => markAsRead(id)}
            onAction={(notifId, actionId) => {
              const route = actionRoutes[actionId];
              if (route) {
                markAsRead(notifId);
                router.navigate({ to: route });
              }
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <PageContainer
      pageTitle={t('notifications.pageTitle')}
      pageDescription={t('notifications.pageDescription')}
      pageHeaderAction={
        count > 0 ? (
          <Button variant='outline' size='sm' onClick={() => markAllAsRead()}>
            {t('notifications.markAllAsRead')}
          </Button>
        ) : undefined
      }
    >
      <Tabs defaultValue='all'>
        <TabsList>
          <TabsTrigger value='all'>
            {t('notifications.allCount', { count: notifications.length })}
          </TabsTrigger>
          <TabsTrigger value='unread'>
            {t('notifications.unreadCount', { count: unreadNotifications.length })}
          </TabsTrigger>
          <TabsTrigger value='read'>
            {t('notifications.readCount', { count: readNotifications.length })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='all' className='mt-4'>
          {renderList(notifications)}
        </TabsContent>
        <TabsContent value='unread' className='mt-4'>
          {renderList(unreadNotifications)}
        </TabsContent>
        <TabsContent value='read' className='mt-4'>
          {renderList(readNotifications)}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
