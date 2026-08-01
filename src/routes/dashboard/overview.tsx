import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/lib/auth/auth-client';
import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { BarGraph } from '@/features/overview/components/bar-graph';
import { RecentSales } from '@/features/overview/components/recent-sales';
import { AreaGraph } from '@/features/overview/components/area-graph';
import { PieGraph } from '@/features/overview/components/pie-graph';
import StaffDashboard from '@/features/attendance/components/staff-dashboard';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/overview')({
  ssr: 'data-only',
  component: OverviewPage
});

function OverviewPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const role = session?.user?.role;
  const isStaff = role === 'employee' || role === 'technician';

  if (isStaff) {
    return <StaffDashboard />;
  }

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>{t('overview.welcome')}</h2>
        </div>
        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>{t('overview.totalRevenue')}</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                $1,250.00
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {t('overview.trendingUpMonth')} <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>{t('overview.visitorsLast6Months')}</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>{t('overview.newCustomers')}</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                1,234
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingDown />
                  -20%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {t('overview.down20Period')} <Icons.trendingDown className='size-4' />
              </div>
              <div className='text-muted-foreground'>{t('overview.acquisitionAttention')}</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>{t('overview.activeAccounts')}</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                45,678
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {t('overview.strongRetention')} <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>{t('overview.engagementTargets')}</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>{t('overview.growthRate')}</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                4.5%
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +4.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {t('overview.steadyIncrease')} <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>{t('overview.meetsGrowthProjections')}</div>
            </CardFooter>
          </Card>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>
            <BarGraph />
          </div>
          <div className='col-span-4 md:col-span-3'>
            <RecentSales />
          </div>
          <div className='col-span-4'>
            <AreaGraph />
          </div>
          <div className='col-span-4 min-h-0 md:col-span-3'>
            <PieGraph />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
