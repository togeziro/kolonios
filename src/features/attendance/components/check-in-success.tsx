import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useTranslation } from 'react-i18next';

interface CheckInSuccessProps {
  time: string;
  locationName: string;
  onDone: () => void;
}

export function CheckInSuccess({ time, locationName, onDone }: CheckInSuccessProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <Card className='w-full max-w-sm'>
        <CardContent className='flex flex-col items-center space-y-6 p-8'>
          <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20'>
            <Icons.circleCheck className='h-10 w-10 text-green-500' />
          </div>

          <div className='text-center'>
            <h2 className='text-xl font-semibold'>{t('checkInSuccess.title')}</h2>
            <p className='mt-1 text-sm text-zinc-400'>
              {t('checkInSuccess.presentAt', { location: locationName })}
            </p>
          </div>

          <div className='flex gap-2'>
            <Badge variant='outline'>{time}</Badge>
            <Badge variant='outline' className='border-green-500 text-green-400'>
              {t('checkInSuccess.geofenceOk')}
            </Badge>
            <Badge variant='outline' className='border-green-500 text-green-400'>
              {t('checkInSuccess.selfieOk')}
            </Badge>
          </div>

          <Button className='w-full' onClick={onDone}>
            {t('checkInSuccess.done')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
