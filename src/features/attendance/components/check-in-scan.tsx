import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { LocationMap } from './location-map';
import { FaceCapture } from './face-capture';
import { useTranslation } from 'react-i18next';

interface CheckInScanProps {
  location: {
    id: number;
    name: string;
    latitude: number | null;
    longitude: number | null;
    radius: number | null;
  } | null;
  shift: { id: number; name: string; start_time: string; end_time: string } | null;
  isCheckedIn: boolean;
  elapsedTime?: string;
  accuracyLevel: 'loose' | 'medium' | 'tight';
  onCheckIn: (descriptor: number[], photo: string, matched: boolean) => void;
  onCheckOut: () => void;
}

export function CheckInScan({
  location,
  shift,
  isCheckedIn,
  elapsedTime,
  accuracyLevel,
  onCheckIn,
  onCheckOut
}: CheckInScanProps) {
  const { t } = useTranslation();

  const handleCapture = (descriptor: number[], photo: string) => {
    onCheckIn(descriptor, photo, true);
  };

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-semibold'>{t('checkIn.title')}</h1>
        <Button variant='ghost' size='icon'>
          <Icons.moreVertical className='h-5 w-5' />
        </Button>
      </div>

      {isCheckedIn && (
        <Card>
          <CardContent className='flex items-center justify-between p-4'>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 rounded-full bg-green-500' />
              <div>
                <p className='text-sm font-medium'>{t('checkIn.onShift')}</p>
                <p className='text-xs text-zinc-400'>{elapsedTime}</p>
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onCheckOut}>
              {t('checkIn.checkOut')}
            </Button>
          </CardContent>
        </Card>
      )}

      {location && (
        <Card>
          <CardContent className='p-4'>
            <div className='mb-2 flex items-center justify-between'>
              <div>
                <p className='font-medium'>{location.name}</p>
              </div>
              <Badge variant='outline' className='border-green-500 text-green-400'>
                <Icons.shield className='mr-1 h-3 w-3' />
                {t('checkIn.geofenceActive')}
              </Badge>
            </div>
            {location.latitude != null && location.longitude != null && (
              <LocationMap
                coordinates={{ lat: location.latitude, lng: location.longitude }}
                radius={location.radius ?? 100}
                readOnly
                height={120}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-center'>{t('checkIn.faceRecognition')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FaceCapture onCapture={handleCapture} />
        </CardContent>
      </Card>
    </div>
  );
}
