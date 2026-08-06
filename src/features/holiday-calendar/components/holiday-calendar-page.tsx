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
      <Tabs className='h-full gap-4' defaultValue='list'>
        <TabsList className='w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none'>
          <TabsTrigger value='list'>{t('holiday.listView')}</TabsTrigger>
          <TabsTrigger value='calendar'>
            <Icons.calendar className='mr-2 h-4 w-4' />
            {t('holiday.calendarView')}
          </TabsTrigger>
          <TabsTrigger value='settings'>
            <Icons.settings className='mr-2 h-4 w-4' />
            {t('holiday.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='list' className='mt-0'>
          <HolidayCalendarListing />
        </TabsContent>

        <TabsContent value='calendar' className='mt-0'>
          <HolidayCalendarView />
        </TabsContent>

        <TabsContent value='settings' className='mt-0'>
          <HolidayApiSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
