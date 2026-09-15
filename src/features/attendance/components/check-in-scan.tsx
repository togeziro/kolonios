import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Icons } from '@/components/icons';
import { LocationMap } from './location-map';
import { FaceCapture } from './face-capture';
import { useTranslation } from 'react-i18next';

export interface CheckInLocationOption {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
}

export interface CheckInShiftOption {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface CheckInScanProps {
  locations: CheckInLocationOption[];
  shifts: CheckInShiftOption[];
  selectedLocationId: number | null;
  selectedShiftId: number | null;
  onSelectLocation: (id: number) => void;
  onSelectShift: (id: number) => void;
  location: CheckInLocationOption | null;
  shift: CheckInShiftOption | null;
  noLocationSelected: boolean;
  faceError: string | null;
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
  locations,
  shifts,
  selectedLocationId,
  selectedShiftId,
  onSelectLocation,
  onSelectShift,
  location,
  shift: _shift,
  noLocationSelected,
  faceError,
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

  const showEnrollmentGate = !faceEnrollmentPending && !faceEnrolled;

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

      <Card>
        <CardContent className='space-y-3 p-4'>
          <p className='text-sm font-medium'>{t('checkIn.selectLocationTitle')}</p>
          {locations.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {locations.map((loc) => (
                <Button
                  key={loc.id}
                  variant={selectedLocationId === loc.id ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onSelectLocation(loc.id)}
                >
                  <Icons.globe className='mr-1 h-4 w-4' />
                  {loc.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>{t('checkIn.noLocationsConfigured')}</p>
          )}
          {noLocationSelected && (
            <p className='text-sm text-destructive'>{t('checkIn.selectLocationFirst')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className='space-y-3 p-4'>
          <p className='text-sm font-medium'>{t('checkIn.selectShiftTitle')}</p>
          {shifts.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {shifts.map((s) => (
                <Button
                  key={s.id}
                  variant={selectedShiftId === s.id ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onSelectShift(s.id)}
                >
                  <Icons.clock className='mr-1 h-4 w-4' />
                  {`${s.name} (${s.start_time} – ${s.end_time})`}
                </Button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>{t('checkIn.noShiftsConfigured')}</p>
          )}
        </CardContent>
      </Card>

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
        <CardContent className='space-y-3'>
          {faceError && <p className='text-center text-sm text-destructive'>{faceError}</p>}
          {showEnrollmentGate ? (
            <div className='space-y-3 text-center'>
              <p className='text-sm text-muted-foreground'>{t('checkIn.enrollmentGateHint')}</p>
              <Button asChild className='w-full'>
                <Link to='/dashboard/attendance/face-settings'>{t('checkIn.goToEnrollment')}</Link>
              </Button>
            </div>
          ) : (
            <FaceCapture onCapture={handleCapture} onRetake={onRetake} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
