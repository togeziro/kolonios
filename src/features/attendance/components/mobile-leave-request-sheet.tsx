import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import LeaveRequestFields from './leave-request-fields';
import { useTranslation } from 'react-i18next';

export default function MobileLeaveRequestSheet() {
  const { t } = useTranslation();
  return (
    <div className='md:hidden'>
      <Sheet>
        <SheetTrigger asChild>
          <Button className='w-full gap-2'>
            <Icons.calendar className='h-4 w-4' />
            {t('attendance.requestLeave')}
          </Button>
        </SheetTrigger>
        <SheetContent side='bottom' className='rounded-t-2xl'>
          <SheetHeader>
            <SheetTitle>{t('attendance.newLeaveRequest')}</SheetTitle>
            <SheetDescription>{t('attendance.leaveRequestDescription')}</SheetDescription>
          </SheetHeader>
          <div className='pt-4'>
            <LeaveRequestFields />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
