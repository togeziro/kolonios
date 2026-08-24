import PageContainer from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaGraph } from './area-graph';
import { BarGraph } from './bar-graph';
import { PieGraph } from './pie-graph';
import { RecentSales } from './recent-sales';
import { useTranslation } from 'react-i18next';

export default function OverViewPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <h2 className='text-2xl font-bold tracking-tight'>{t('overview.welcome')}</h2>
        <Tabs defaultValue='overview' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>{t('overview.overviewTab')}</TabsTrigger>
            <TabsTrigger value='analytics' disabled>
              {t('overview.analyticsTab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
              <div className='col-span-4'>
                <BarGraph />
              </div>
              <Card className='col-span-4 md:col-span-3'>
                <RecentSales />
              </Card>
              <div className='col-span-4'>
                <AreaGraph />
              </div>
              <div className='col-span-4 md:col-span-3'>
                <PieGraph />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
