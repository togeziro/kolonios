import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import LeaveRequestFields from './leave-request-fields';
import { useTranslation } from 'react-i18next';

export default function LeaveRequestForm() {
  const { t } = useTranslation();
  return (
    <div className='hidden md:block'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.calendar className='h-5 w-5' />
            {t('attendance.newLeaveRequest')}
          </CardTitle>
          <CardDescription>{t('attendance.leaveRequestDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaveRequestFields />
        </CardContent>
      </Card>
    </div>
  );
}
