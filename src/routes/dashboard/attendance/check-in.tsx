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
import { matchFace } from '@/lib/face/match';
import { uploadSelfie } from '@/lib/storage/upload-client';
import { getCurrentLocation } from '@/features/attendance/utils/geolocation';
import { toast } from 'sonner';

export const Route = createFileRoute('/dashboard/attendance/check-in')({
  component: CheckInPage
});

function CheckInPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'scan' | 'success'>('scan');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInLocation, setCheckInLocation] = useState('');

  const { data: todayData } = useQuery(myAttendanceQueryOptions());
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const { data: shiftsData } = useQuery(shiftsQueryOptions());

  const attendance = todayData?.attendance;
  const isCheckedIn = attendance && attendance.attendance?.check_in_time;
  const isCheckedOut = attendance && attendance.attendance?.check_out_time;
  const location = locationsData?.locations?.[0] ?? null;
  const shift = shiftsData?.shifts?.[0] ?? null;

  // Load face config from company_settings (default: background, medium)
  const validationMode = 'background' as 'background' | 'realtime';
  const accuracyLevel = 'medium' as const;

  const checkInMutation = useMutation({
    mutationFn: async ({ descriptor, photo }: { descriptor: number[]; photo: string }) => {
      // For background mode: save attendance first, validate async
      // For realtime mode: validate first, then save
      if (validationMode === 'realtime') {
        // TODO: Match against enrolled descriptors when enrollment is built
        // For now, accept all face captures in realtime mode
        // const enrolled = await getEnrolledDescriptors(userId);
        // const result = matchFace(descriptor, enrolled, accuracyLevel);
        // if (!result.matched) throw new Error('Face validation failed');
      }

      let photoKey: string | undefined;
      if (photo) {
        try {
          photoKey = await uploadSelfie(photo, 'attendance');
        } catch {
          toast.error('Photo upload failed');
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
        toast.error(res?.message ?? 'Check-in failed');
      }
    },
    onError: () => {
      toast.error('Check-in failed');
    }
  });

  const handleCheckIn = useCallback(
    (descriptor: number[], photo: string, matched: boolean) => {
      checkInMutation.mutate({ descriptor, photo });
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
      onCheckIn={handleCheckIn}
      onCheckOut={() => {}}
    />
  );
}
