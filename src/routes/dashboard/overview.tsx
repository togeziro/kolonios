import { lazy, Suspense, useEffect } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useSession } from '@/lib/auth/auth-client';
import PageContainer from '@/components/layout/page-container';
import { BarGraphSkeleton } from '@/features/overview/components/bar-graph-skeleton';
import { RecentSalesSkeleton } from '@/features/overview/components/recent-sales-skeleton';
import { AreaGraphSkeleton } from '@/features/overview/components/area-graph-skeleton';
import { PieGraphSkeleton } from '@/features/overview/components/pie-graph-skeleton';
import StaffDashboard from '@/features/attendance/components/staff-dashboard';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const BarGraph = lazy(() =>
  import('@/features/overview/components/bar-graph').then((m) => ({ default: m.BarGraph }))
);
const RecentSales = lazy(() =>
  import('@/features/overview/components/recent-sales').then((m) => ({ default: m.RecentSales }))
);
const AreaGraph = lazy(() =>
  import('@/features/overview/components/area-graph').then((m) => ({ default: m.AreaGraph }))
);
const PieGraph = lazy(() =>
  import('@/features/overview/components/pie-graph').then((m) => ({ default: m.PieGraph }))
);

export const Route = createFileRoute('/dashboard/overview')({
  ssr: 'data-only',
  validateSearch: (search: Record<string, unknown>): { denied?: string } => ({
    denied: typeof search.denied === 'string' ? search.denied : undefined
  }),
  component: OverviewPage
});

function OverviewPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const role = session?.user?.role;
  const isTechnician = role === 'technician';
  const search = useSearch({ from: '/dashboard/overview' });

  // When the centralized route guard redirects a denied user here, surface a
  // clear toast. Strip the search param so back-navigation does not re-fire
  // the same toast.
  useEffect(() => {
    if (!search.denied) return;
    toast.error(t('common.noAccess'));
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('denied')) {
        url.searchParams.delete('denied');
        window.history.replaceState(
          {},
          '',
          url.pathname + (url.search ? url.search : '') + url.hash
        );
      }
    }
  }, [search.denied, t]);

  if (isTechnician) {
    return <StaffDashboard />;
  }

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>{t('overview.welcome')}</h2>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>
            <Suspense fallback={<BarGraphSkeleton />}>
              <BarGraph />
            </Suspense>
          </div>
          <div className='col-span-4 md:col-span-3'>
            <Suspense fallback={<RecentSalesSkeleton />}>
              <RecentSales />
            </Suspense>
          </div>
          <div className='col-span-4'>
            <Suspense fallback={<AreaGraphSkeleton />}>
              <AreaGraph />
            </Suspense>
          </div>
          <div className='col-span-4 min-h-0 md:col-span-3'>
            <Suspense fallback={<PieGraphSkeleton />}>
              <PieGraph />
            </Suspense>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
