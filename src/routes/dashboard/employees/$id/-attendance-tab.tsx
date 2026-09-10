import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';

import { Card } from '@/components/ui/card';

export function EmployeeAttendanceTab() {
  const { t } = useTranslation();

  return (
    <Card className='flex flex-col items-center gap-2 rounded-md border border-dashed py-12 text-center'>
      <CalendarDays className='text-muted-foreground h-8 w-8' />
      <p className='text-sm font-medium'>{t('employee.attendancePlaceholderTitle')}</p>
      <p className='text-muted-foreground max-w-md text-xs'>
        {t('employee.attendancePlaceholder')}
      </p>
    </Card>
  );
}
