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
import { CHECKIN_ERROR_I18N_KEYS } from '../lib/checkin-error-keys';
import { PHOTO_UPLOAD_FAILED, uploadSelfie } from '@/lib/storage/upload-client';
import { getCurrentLocation, type DeviceLocation, type LocationResult } from '../utils/geolocation';
import { LocationMap } from './location-map';
import { SelfieCapture } from './selfie-capture';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Sentinel so onError knows a specific toast was already shown and must not
// double-toast the generic GPS message.
const GPS_UNAVAILABLE = 'GPS_UNAVAILABLE';

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
    if (res.code && CHECKIN_ERROR_I18N_KEYS[res.code]) return t(CHECKIN_ERROR_I18N_KEYS[res.code]);
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
    mutationFn: async () => {
      // GPS-first: never hit the server (or upload a selfie) without
      // coordinates — the server would reject with GPS_REQUIRED and each
      // attempt spams the audit log. Stale/inaccurate fixes are still
      // submitted so the server can reject them precisely.
      if (!deviceLocation) {
        toast.error(t('attendanceAdmin.gpsUnavailable'));
        throw new Error(GPS_UNAVAILABLE);
      }
      // A missing locationId fails server-side with the same GPS_REQUIRED
      // code, so catch it here with a message that tells the user what to
      // do (tap the work-location button) instead.
      if (selectedLocation == null) {
        toast.error(t('attendanceAdmin.selectLocationFirst'));
        throw new Error(GPS_UNAVAILABLE);
      }
      let photoKey: string | undefined;
      if (selfie) {
        try {
          photoKey = await uploadSelfie(selfie, 'attendance');
        } catch {
          toast.error(t('attendanceAdmin.photoUploadFailed'));
          throw new Error(PHOTO_UPLOAD_FAILED);
        }
      }
      return checkInFn({
        data: {
          locationId: selectedLocation ?? undefined,
          shiftId: selectedShift ?? undefined,
          latitude: deviceLocation?.latitude,
          longitude: deviceLocation?.longitude,
          accuracy: deviceLocation?.accuracy,
          capturedAt: deviceLocation?.capturedAt,
          photo: photoKey
        }
      });
    },
    onSuccess: (res) => {
      if (res?.success) {
        invalidateAttendance();
      } else {
        toast.error(errorMessage(res));
      }
    },
    onError: (err) => {
      if (
        err instanceof Error &&
        err.message !== PHOTO_UPLOAD_FAILED &&
        err.message !== GPS_UNAVAILABLE
      ) {
        toast.error(t('attendanceAdmin.gpsUnavailable'));
      }
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      // Same GPS-first guard as check-in: the server validates checkout
      // against the locked check-in policy, so missing coordinates would
      // always fail with GPS_REQUIRED.
      if (!deviceLocation) {
        toast.error(t('attendanceAdmin.gpsUnavailable'));
        throw new Error(GPS_UNAVAILABLE);
      }
      let photoKey: string | undefined;
      if (checkOutSelfie) {
        try {
          photoKey = await uploadSelfie(checkOutSelfie, 'attendance');
        } catch {
          toast.error(t('attendanceAdmin.photoUploadFailed'));
          throw new Error(PHOTO_UPLOAD_FAILED);
        }
      }
      return checkOutFn({
        data: {
          attendanceId: attendance!.attendance!.id,
          latitude: deviceLocation?.latitude,
          longitude: deviceLocation?.longitude,
          accuracy: deviceLocation?.accuracy,
          capturedAt: deviceLocation?.capturedAt,
          photo: photoKey
        }
      });
    },
    onSuccess: (res) => {
      if (!clearSelfieAfterSuccess(res, setCheckOutSelfie, invalidateAttendance)) {
        toast.error(errorMessage(res));
      }
    },
    onError: (err) => {
      if (
        err instanceof Error &&
        err.message !== PHOTO_UPLOAD_FAILED &&
        err.message !== GPS_UNAVAILABLE
      ) {
        toast.error(t('attendanceAdmin.gpsUnavailable'));
      }
    }
  });

  const locations = locationsData?.locations ?? [];
  const shifts = shiftsData?.shifts ?? [];

  // Single-site convenience: with exactly one work location there is nothing
  // to choose, so preselect it — otherwise check-in submits without a
  // locationId and fails with GPS_REQUIRED (seen on prod with user Dhani,
  // whose employee record carries no default location).
  // Adjust-state-during-render pattern (same as LocationForm); the key is a
  // primitive so a fresh locations array identity alone never retriggers it.
  const locationKey =
    locations.length === 1 ? `single:${locations[0].id}` : `multi:${locations.length}`;
  const [prevLocationKey, setPrevLocationKey] = useState(locationKey);
  if (locationKey !== prevLocationKey) {
    setPrevLocationKey(locationKey);
    if (selectedLocation == null && locations.length === 1) {
      setSelectedLocation(locations[0].id);
    }
  }

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

  // The checkout view validates against the location locked at check-in,
  // so its map centers on that geofence (falling back to the device fix).
  const checkoutLocationObj =
    locationsData?.locations?.find((l) => l.id === attendance?.attendance?.lock_location) ?? null;
  const checkoutMapCoordinates =
    checkoutLocationObj?.latitude != null && checkoutLocationObj?.longitude != null
      ? { lat: checkoutLocationObj.latitude, lng: checkoutLocationObj.longitude }
      : deviceLocation
        ? { lat: deviceLocation.latitude, lng: deviceLocation.longitude }
        : null;

  // Shared location-acquisition box. It used to exist only in the check-in
  // branch, so after a reload the checkout branch sent no coordinates and
  // every checkout failed with GPS_REQUIRED.
  const renderLocationBox = (mapCoords: { lat: number; lng: number } | null, radius: number) => (
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
          {deviceLocation ? t('attendanceAdmin.refreshLocation') : t('attendanceAdmin.getLocation')}
        </Button>
      </div>

      {deviceLocation && (
        <>
          <LocationMap
            coordinates={mapCoords}
            radius={radius}
            readOnly
            deviceLocation={{
              lat: deviceLocation.latitude,
              lng: deviceLocation.longitude,
              accuracy: deviceLocation.accuracy
            }}
            height={200}
          />
          <p className='text-xs text-muted-foreground'>
            {deviceLocation.latitude.toFixed(5)}, {deviceLocation.longitude.toFixed(5)} {'\u00b7'}{' '}
            {'\u00b1'}
            {deviceLocation.accuracy}
            {t('attendanceAdmin.meters')}
          </p>
        </>
      )}

      {locationStatus && locationStatus !== 'success' && (
        <p className='text-xs text-destructive'>{t('attendanceAdmin.gpsRefreshNeeded')}</p>
      )}
    </div>
  );

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

            {renderLocationBox(mapCoordinates, selectedLocationObj?.radius ?? 100)}

            <SelfieCapture
              required={false}
              disabled={checkInMutation.isPending}
              onCapture={setSelfie}
              onClear={() => setSelfie(null)}
            />

            <Button
              className='w-full'
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending || locating}
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
            {renderLocationBox(checkoutMapCoordinates, checkoutLocationObj?.radius ?? 100)}

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
              disabled={checkOutMutation.isPending || locating}
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
