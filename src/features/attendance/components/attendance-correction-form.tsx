import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { requestAttendanceCorrectionFn } from '../api/service';

export function AttendanceCorrectionForm({ attendanceId }: { attendanceId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [requestedCheckInTime, setRequestedCheckInTime] = useState('');
  const [requestedCheckOutTime, setRequestedCheckOutTime] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      requestAttendanceCorrectionFn({
        data: {
          attendanceId,
          requestedCheckInTime: requestedCheckInTime || undefined,
          requestedCheckOutTime: requestedCheckOutTime || undefined,
          note: note || undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.correctionRequested'));
        setRequestedCheckInTime('');
        setRequestedCheckOutTime('');
        setNote('');
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      } else {
        toast.error(res?.message ?? t('attendanceAdmin.correctionReviewFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.correctionReviewFailed'))
  });

  const canSubmit = (requestedCheckInTime || requestedCheckOutTime || note) && !mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.correctionTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.correctionDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='corr-in'>{t('attendanceAdmin.requestedCheckIn')}</Label>
            <Input
              id='corr-in'
              type='time'
              value={requestedCheckInTime}
              onChange={(e) => setRequestedCheckInTime(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='corr-out'>{t('attendanceAdmin.requestedCheckOut')}</Label>
            <Input
              id='corr-out'
              type='time'
              value={requestedCheckOutTime}
              onChange={(e) => setRequestedCheckOutTime(e.target.value)}
            />
          </div>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='corr-note'>{t('attendanceAdmin.correctionNote')}</Label>
          <Textarea
            id='corr-note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
          {t('attendanceAdmin.submitCorrection')}
        </Button>
      </CardContent>
    </Card>
  );
}
