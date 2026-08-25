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
  shift: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
  } | null;
  isCheckedIn: boolean;
  elapsedTime?: string;
  accuracyLevel: 'loose' | 'medium' | 'tight';
  faceEnrolled: boolean;
  faceEnrollmentPending?: boolean;
  onCheckIn: (
    descriptor: number[],
    photo: string,
    antiSpoofScore: number | null,
    livenessScore: number | null
  ) => void;
  onCheckOut: () => void;
  onRetake?: () => void;
}

export function CheckInScan({
  location,
  shift,
  isCheckedIn,
  elapsedTime,
  accuracyLevel,
  faceEnrolled,
  faceEnrollmentPending = false,
  onCheckIn,
  onCheckOut,
  onRetake
}: CheckInScanProps) {
  const { t } = useTranslation();

  const handleCapture = (
    descriptor: number[],
    photo: string,
    antiSpoofScore: number | null,
    livenessScore: number | null
  ) => {
    onCheckIn(descriptor, photo, antiSpoofScore, livenessScore);
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
                coordinates={{
                  lat: location.latitude,
                  lng: location.longitude
                }}
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
          <div className='flex justify-center gap-2'>
            {faceEnrollmentPending ? (
              // SSR-safe placeholder: query data is client-only, so rendering
              // the real badge during hydration would mismatch the server HTML.
              <Badge variant='outline' className='border-zinc-600 text-zinc-400'>
                {t('checkIn.faceStatusLoading')}
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className={
                  faceEnrolled ? 'border-green-500 text-green-400' : 'border-zinc-600 text-zinc-400'
                }
              >
                {faceEnrolled ? t('checkIn.faceEnrolled') : t('checkIn.faceNotEnrolled')}
              </Badge>
            )}
            <Badge variant='outline'>{accuracyLevel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <FaceCapture onCapture={handleCapture} onRetake={onRetake} />
        </CardContent>
      </Card>
    </div>
  );
}
