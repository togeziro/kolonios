import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import {
  myAttendanceQueryOptions,
  locationsQueryOptions,
  shiftsQueryOptions
} from '../api/queries';
import { checkInFn, checkOutFn } from '../api/service';
import { getCurrentLocation, type DeviceLocation, type LocationResult } from '../utils/geolocation';
import { LocationMap } from './location-map';
import { SelfieCapture } from './selfie-capture';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function clearSelfieAfterSuccess(
  res: { success?: boolean; code?: string; message?: string } | null | undefined,
  setCheckOutSelfie: (selfie: string | null) => void,
  invalidate: () => void
): boolean {
  if (!res?.success) return false;
  setCheckOutSelfie(null);
  invalidate();
  return true;
}

const ERROR_I18N_KEYS: Record<string, string> = {
  GPS_REQUIRED: 'attendanceAdmin.errGpsRequired',
  GPS_STALE: 'attendanceAdmin.errGpsStale',
  GPS_INACCURATE: 'attendanceAdmin.errGpsInaccurate',
  OUTSIDE_RADIUS: 'attendanceAdmin.errOutsideRadius',
  NO_SCHEDULE: 'attendanceAdmin.errNoSchedule',
  SELFIE_REQUIRED: 'attendanceAdmin.errSelfieRequired',
  NO_CHECK_IN: 'attendanceAdmin.errNoCheckIn',
  ALREADY_CHECKED_OUT: 'attendanceAdmin.errAlreadyCheckedOut'
};

export default function AttendanceCheckCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationResult['status'] | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [checkOutSelfie, setCheckOutSelfie] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const { data: shiftsData } = useQuery(shiftsQueryOptions());

  const attendance = todayData?.attendance;
  const isCheckedIn = attendance && attendance.attendance?.check_in_time;
  const isCheckedOut = attendance && attendance.attendance?.check_out_time;
  const status = attendance?.attendance?.attendance_status;

  const selectedLocationObj =
    locationsData?.locations?.find((l) => l.id === selectedLocation) ?? null;

  // Translate a server error code to a localized toast; fall back to the
  // server-provided message (or the generic GPS message).
  const errorMessage = (res: { code?: string; message?: string } | undefined | null): string => {
    if (!res) return t('attendanceAdmin.gpsUnavailable');
    if (res.code && ERROR_I18N_KEYS[res.code]) return t(ERROR_I18N_KEYS[res.code]);
    return res.message ?? t('attendanceAdmin.gpsUnavailable');
  };

  const fetchLocation = async () => {
    setLocating(true);
    const result = await getCurrentLocation();
    setLocating(false);
    setLocationStatus(result.status);
    if (result.status === 'success') {
      setDeviceLocation(result.location);
    } else if (result.status === 'stale' || result.status === 'inaccurate') {
      setDeviceLocation(result.location);
      toast.error(t('attendanceAdmin.gpsRefreshNeeded'));
    } else {
      setDeviceLocation(null);
      toast.error(t('attendanceAdmin.gpsUnavailable'));
    }
  };

  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const checkInMutation = useMutation({
    mutationFn: () =>
      checkInFn({
        data: {
          locationId: selectedLocation ?? undefined,
          shiftId: selectedShift ?? undefined,
          latitude: deviceLocation?.latitude,
          longitude: deviceLocation?.longitude,
          accuracy: deviceLocation?.accuracy,
          capturedAt: deviceLocation?.capturedAt,
          photo: selfie ?? undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        invalidateAttendance();
      } else {
        toast.error(errorMessage(res));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.gpsUnavailable'))
  });

  const checkOutMutation = useMutation({
    mutationFn: () =>
      checkOutFn({
        data: {
          attendanceId: attendance!.attendance!.id,
          latitude: deviceLocation?.latitude,
          longitude: deviceLocation?.longitude,
          accuracy: deviceLocation?.accuracy,
          capturedAt: deviceLocation?.capturedAt,
          photo: checkOutSelfie ?? undefined
        }
      }),
    onSuccess: (res) => {
      if (!clearSelfieAfterSuccess(res, setCheckOutSelfie, invalidateAttendance)) {
        toast.error(errorMessage(res));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.gpsUnavailable'))
  });

  const locations = locationsData?.locations ?? [];
  const shifts = shiftsData?.shifts ?? [];

  // The map centers on the SELECTED location's geofence; the device position
  // is drawn separately as the blue marker. Falls back to the device position
  // when no location is selected yet.
  const mapCoordinates =
    selectedLocationObj &&
    selectedLocationObj.latitude != null &&
    selectedLocationObj.longitude != null
      ? { lat: selectedLocationObj.latitude, lng: selectedLocationObj.longitude }
      : deviceLocation
        ? { lat: deviceLocation.latitude, lng: deviceLocation.longitude }
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Icons.clock className='h-5 w-5' />
          {t('attendance.todayAttendance')}
        </CardTitle>
        <CardDescription>
          {new Date().toLocaleDateString(i18n.language === 'id' ? 'id-ID' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {status && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>{t('attendance.statusLabel')}</span>
            <Badge
              variant={
                status === 'present' ? 'default' : status === 'late' ? 'secondary' : 'outline'
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        )}

        {isCheckedIn && (
          <div className='text-sm text-muted-foreground'>
            {t('attendance.checkInLabel')} {attendance!.attendance!.check_in_time}
          </div>
        )}

        {isCheckedOut && (
          <div className='text-sm text-muted-foreground'>
            {t('attendance.checkOutLabel')} {attendance!.attendance!.check_out_time}
          </div>
        )}

        {!isCheckedIn && (
          <div className='space-y-3'>
            {locations.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {locations.map((loc) => (
                  <Button
                    key={loc.id}
                    variant={selectedLocation === loc.id ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setSelectedLocation(loc.id)}
                  >
                    <Icons.globe className='mr-1 h-4 w-4' />
                    {loc.name}
                  </Button>
                ))}
              </div>
            )}
            {shifts.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {shifts.map((s) => (
                  <Button
                    key={s.id}
                    variant={selectedShift === s.id ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setSelectedShift(s.id)}
                  >
                    <Icons.clock className='mr-1 h-4 w-4' />
                    {`${s.name} (${s.start_time} \u2013 ${s.end_time})`}
                  </Button>
                ))}
              </div>
            )}

            <div className='space-y-2 rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>{t('attendanceAdmin.currentLocation')}</span>
                <Button
                  variant={deviceLocation ? 'outline' : 'default'}
                  size='sm'
                  onClick={() => void fetchLocation()}
                  disabled={locating}
                >
                  <Icons.location className='mr-1 h-4 w-4' />
                  {deviceLocation
                    ? t('attendanceAdmin.refreshLocation')
                    : t('attendanceAdmin.getLocation')}
                </Button>
              </div>

              {deviceLocation && (
                <>
                  <LocationMap
                    coordinates={mapCoordinates}
                    radius={selectedLocationObj?.radius ?? 100}
                    readOnly
                    deviceLocation={{
                      lat: deviceLocation.latitude,
                      lng: deviceLocation.longitude,
                      accuracy: deviceLocation.accuracy
                    }}
                    height={200}
                  />
                  <p className='text-xs text-muted-foreground'>
                    {deviceLocation.latitude.toFixed(5)}, {deviceLocation.longitude.toFixed(5)}{' '}
                    {'\u00b7'} {'\u00b1'}
                    {deviceLocation.accuracy}
                    {t('attendanceAdmin.meters')}
                  </p>
                </>
              )}

              {locationStatus && locationStatus !== 'success' && (
                <p className='text-xs text-destructive'>{t('attendanceAdmin.gpsRefreshNeeded')}</p>
              )}
            </div>

            <SelfieCapture
              required={false}
              disabled={checkInMutation.isPending}
              onCapture={setSelfie}
              onClear={() => setSelfie(null)}
            />

            <Button
              className='w-full'
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.login className='mr-2 h-4 w-4' />
              )}
              {t('attendance.checkIn')}
            </Button>
          </div>
        )}

        {isCheckedIn && !isCheckedOut && (
          <div className='space-y-3'>
            <SelfieCapture
              required={false}
              disabled={checkOutMutation.isPending}
              onCapture={setCheckOutSelfie}
              onClear={() => setCheckOutSelfie(null)}
            />

            <Button
              className='w-full'
              variant='secondary'
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
            >
              {checkOutMutation.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.logout className='mr-2 h-4 w-4' />
              )}
              {t('attendance.checkOut')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
