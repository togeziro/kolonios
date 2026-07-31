import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import LeaveRequestFields from './leave-request-fields';

export default function LeaveRequestForm() {
  return (
    <div className='hidden md:block'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.calendar className='h-5 w-5' />
            New Leave Request
          </CardTitle>
          <CardDescription>Submit a leave request for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveRequestFields />
        </CardContent>
      </Card>
    </div>
  );
}
