import { useState, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  myAttendanceQueryOptions,
  locationsQueryOptions,
  shiftsQueryOptions
} from '@/features/attendance/api/queries';
import { checkInFn } from '@/features/attendance/api/service';
import { CheckInScan } from '@/features/attendance/components/check-in-scan';
import { CheckInSuccess } from '@/features/attendance/components/check-in-success';
import { uploadSelfie } from '@/lib/storage/upload-client';
import { getCurrentLocation } from '@/features/attendance/utils/geolocation';
import {
  myFaceEnrollmentQueryOptions,
  faceSettingsQueryOptions
} from '@/features/face/api/queries';
import { verifyFaceFn } from '@/features/face/api/service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dashboard/attendance/check-in')({
  component: CheckInPage
});

function CheckInPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'scan' | 'success'>('scan');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInLocation, setCheckInLocation] = useState('');
  const [, setFaceError] = useState<string | null>(null);

  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const { data: locationsData, isPending: locationsPending } = useQuery(locationsQueryOptions());
  const { data: shiftsData, isPending: shiftsPending } = useQuery(shiftsQueryOptions());
  const { data: faceEnrollment, isPending: faceEnrollmentPending } = useQuery(
    myFaceEnrollmentQueryOptions()
  );
  const { data: faceSettings, isPending: faceSettingsPending } = useQuery(
    faceSettingsQueryOptions()
  );

  const attendance = todayData?.attendance;
  const isCheckedIn = attendance && attendance.attendance?.check_in_time;
  const isCheckedOut = attendance && attendance.attendance?.check_out_time;
  // Query data is client-only: rendering location/shift cards from it during
  // hydration would mismatch the server HTML (SSR renders without the data).
  // Defer those cards until the queries resolve after mount.
  const location =
    !locationsPending && !shiftsPending ? (locationsData?.locations?.[0] ?? null) : null;
  const shift = !locationsPending && !shiftsPending ? (shiftsData?.shifts?.[0] ?? null) : null;

  const accuracyLevel = faceSettings?.accuracyLevel ?? 'medium';

  const checkInMutation = useMutation({
    mutationFn: async ({
      descriptor,
      photo,
      antiSpoofScore,
      livenessScore
    }: {
      descriptor: number[];
      photo: string;
      antiSpoofScore: number | null;
      livenessScore: number | null;
    }) => {
      // Server-side face verification (matching + anti-spoof/liveness gate).
      // The client never decides "matched" — only the server does.
      const verify = await verifyFaceFn({
        data: {
          descriptor,
          antiSpoofScore: antiSpoofScore ?? undefined,
          livenessScore: livenessScore ?? undefined
        }
      });
      if (!verify.verified) {
        throw new Error(
          verify.reason === 'NOT_ENROLLED' ? 'FACE_NOT_ENROLLED' : 'FACE_VERIFICATION_FAILED'
        );
      }

      let photoKey: string | undefined;
      if (photo) {
        try {
          photoKey = await uploadSelfie(photo, 'attendance');
        } catch {
          toast.error(t('checkIn.photoUploadFailed'));
          return;
        }
      }

      const loc = await getCurrentLocation();

      return checkInFn({
        data: {
          locationId: location?.id,
          shiftId: shift?.id,
          latitude: loc.status === 'success' ? loc.location.latitude : undefined,
          longitude: loc.status === 'success' ? loc.location.longitude : undefined,
          accuracy: loc.status === 'success' ? loc.location.accuracy : undefined,
          photo: photoKey
        }
      });
    },
    onSuccess: (res) => {
      if (res?.success) {
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        setCheckInTime(new Date().toLocaleTimeString());
        setCheckInLocation(location?.name ?? '');
        setStep('success');
      } else {
        toast.error(res?.message ?? t('checkIn.failed'));
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : '';
      if (message === 'FACE_NOT_ENROLLED') {
        setFaceError(t('checkIn.faceNotEnrolledError'));
      } else if (message === 'FACE_VERIFICATION_FAILED') {
        setFaceError(t('checkIn.faceVerificationFailed'));
      } else {
        toast.error(t('checkIn.failed'));
      }
    }
  });

  const handleCheckIn = useCallback(
    (
      descriptor: number[],
      photo: string,
      antiSpoofScore: number | null,
      livenessScore: number | null
    ) => {
      setFaceError(null);
      checkInMutation.mutate({
        descriptor,
        photo,
        antiSpoofScore,
        livenessScore
      });
    },
    [checkInMutation]
  );

  const handleDone = useCallback(() => {
    setStep('scan');
  }, []);

  if (step === 'success') {
    return <CheckInSuccess time={checkInTime} locationName={checkInLocation} onDone={handleDone} />;
  }

  return (
    <CheckInScan
      location={location}
      shift={shift}
      isCheckedIn={!!isCheckedIn && !isCheckedOut}
      accuracyLevel={accuracyLevel}
      faceEnrolled={faceEnrollment?.enrolled ?? false}
      faceEnrollmentPending={faceEnrollmentPending || faceSettingsPending}
      onCheckIn={handleCheckIn}
      onCheckOut={() => {}}
    />
  );
}
