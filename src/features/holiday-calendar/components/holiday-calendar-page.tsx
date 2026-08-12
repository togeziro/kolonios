import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HolidayCalendarListing } from './holiday-calendar-listing';
import { HolidayCalendarView } from './holiday-calendar-view';
import { HolidayApiSettings } from './holiday-api-settings';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';

export function HolidayCalendarPage() {
  const { t } = useTranslation();

  return (
    <div className='flex h-full flex-col gap-4'>
      <Tabs className='h-full' defaultValue='list'>
        <TabsList className='flex justify-start overflow-x-auto'>
          <TabsTrigger value='list' className='shrink-0'>
            {t('holiday.listView')}
          </TabsTrigger>
          <TabsTrigger value='calendar' className='shrink-0'>
            <Icons.calendar />
            {t('holiday.calendarView')}
          </TabsTrigger>
          <TabsTrigger value='settings' className='shrink-0'>
            <Icons.settings />
            {t('holiday.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='list' className='flex min-h-0 flex-1 flex-col'>
          <HolidayCalendarListing />
        </TabsContent>

        <TabsContent value='calendar' className='flex min-h-0 flex-1 flex-col'>
          <HolidayCalendarView />
        </TabsContent>

        <TabsContent value='settings' className='flex min-h-0 flex-1 flex-col'>
          <HolidayApiSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
