import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { createLeaveRequestFn } from '../api/service';
import type { LeaveType } from '../api/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' }
] as const;

export default function LeaveRequestFields() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createLeaveRequestFn({
        data: {
          leaveType: leaveType as LeaveType,
          startDate,
          endDate,
          reason: reason || undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendance.leaveSubmitted'));
        setLeaveType('');
        setStartDate('');
        setEndDate('');
        setReason('');
        queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
      } else {
        toast.error(res?.message ?? t('attendance.leaveSubmitFailed'));
      }
    },
    onError: () => {
      toast.error(t('attendance.leaveSubmitFailed'));
    }
  });

  const canSubmit =
    leaveType && startDate && endDate && startDate <= endDate && !mutation.isPending;
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label>{t('attendance.leaveType')}</Label>
        <Select value={leaveType} onValueChange={(v: string) => setLeaveType(v)}>
          <SelectTrigger>
            <SelectValue placeholder={t('attendance.selectLeaveType')} />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label>{t('attendance.startDate')}</Label>
          <Input
            type='date'
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={today}
          />
        </div>
        <div className='space-y-2'>
          <Label>{t('attendance.endDate')}</Label>
          <Input
            type='date'
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || today}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>{t('attendance.reason')}</Label>
        <Textarea
          placeholder={t('attendance.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>

      <Button className='w-full' onClick={() => mutation.mutate()} disabled={!canSubmit}>
        {mutation.isPending ? (
          <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
        ) : (
          <Icons.send className='mr-2 h-4 w-4' />
        )}
        {t('attendance.submitLeaveRequest')}
      </Button>
    </div>
  );
}
