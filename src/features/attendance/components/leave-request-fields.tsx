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
  { value: 'annual', label: 'attendance.leaveTypeAnnual' },
  { value: 'sick', label: 'attendance.leaveTypeSick' },
  { value: 'personal', label: 'attendance.leaveTypePersonal' },
  { value: 'emergency', label: 'attendance.leaveTypeEmergency' },
  { value: 'maternity', label: 'attendance.leaveTypeMaternity' },
  { value: 'paternity', label: 'attendance.leaveTypePaternity' }
] as const;

const ATTACHMENT_REQUIRED_TYPES: LeaveType[] = ['sick'];

export default function LeaveRequestFields() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [leaveType, setLeaveType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState('');

  const attachmentRequired =
    ATTACHMENT_REQUIRED_TYPES.includes(leaveType as LeaveType) && leaveType !== '';

  const mutation = useMutation({
    mutationFn: () =>
      createLeaveRequestFn({
        data: {
          leaveType: leaveType as LeaveType,
          startDate,
          endDate,
          reason: reason || undefined,
          file: file || undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendance.leaveSubmitted'));
        setLeaveType('');
        setStartDate('');
        setEndDate('');
        setReason('');
        setFile('');
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
    leaveType &&
    startDate &&
    endDate &&
    startDate <= endDate &&
    (!attachmentRequired || file.length > 0) &&
    !mutation.isPending;
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
            {leaveTypes.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.label)}
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

      <div className='space-y-2'>
        <Label>
          {t('attendance.attachment')}
          {attachmentRequired && <span className='text-destructive'>{'\u002a'}</span>}
        </Label>
        <Input type='file' onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
        {attachmentRequired && (
          <p className='text-xs text-muted-foreground'>{t('attendance.attachmentRequiredHint')}</p>
        )}
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
