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
            <Icons.calendar className='mr-2 h-4 w-4' />
            {t('holiday.calendarView')}
          </TabsTrigger>
          <TabsTrigger value='settings' className='shrink-0'>
            <Icons.settings className='mr-2 h-4 w-4' />
            {t('holiday.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='list'>
          <HolidayCalendarListing />
        </TabsContent>

        <TabsContent value='calendar'>
          <HolidayCalendarView />
        </TabsContent>

        <TabsContent value='settings'>
          <HolidayApiSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
