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

export default function MobileLeaveRequestSheet() {
  return (
    <div className='md:hidden'>
      <Sheet>
        <SheetTrigger asChild>
          <Button className='w-full gap-2'>
            <Icons.calendar className='h-4 w-4' />
            Request Leave
          </Button>
        </SheetTrigger>
        <SheetContent side='bottom' className='rounded-t-2xl'>
          <SheetHeader>
            <SheetTitle>New Leave Request</SheetTitle>
            <SheetDescription>Submit a leave request for approval</SheetDescription>
          </SheetHeader>
          <div className='pt-4'>
            <LeaveRequestFields />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
