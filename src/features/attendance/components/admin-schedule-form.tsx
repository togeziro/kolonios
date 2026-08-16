import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { createScheduleFn } from '../api/service';

export interface WeekdayRuleForm {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  absenceCutoffMinutes: number;
}

export interface ScheduleFormState {
  name: string;
  startTime: string;
  endTime: string;
  weekdayRules: WeekdayRuleForm[];
}

const emptyForm: ScheduleFormState = {
  name: '',
  startTime: '08:00',
  endTime: '17:00',
  weekdayRules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 10,
    absenceCutoffMinutes: 120
  }))
};

const DAY_I18N_KEYS = [
  'attendance.daySun',
  'attendance.dayMon',
  'attendance.dayTue',
  'attendance.dayWed',
  'attendance.dayThu',
  'attendance.dayFri',
  'attendance.daySat'
];

export function ScheduleForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleFormState>(emptyForm);

  const set = <K extends keyof ScheduleFormState>(key: K, value: ScheduleFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setRule = (index: number, patch: Partial<WeekdayRuleForm>) =>
    setForm((f) => ({
      ...f,
      weekdayRules: f.weekdayRules.map((r, i) => (i === index ? { ...r, ...patch } : r))
    }));

  const mutation = useMutation({
    mutationFn: () =>
      createScheduleFn({
        data: {
          name: form.name,
          startTime: form.startTime,
          endTime: form.endTime,
          weekdayRules: form.weekdayRules
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.scheduleSaved'));
        queryClient.invalidateQueries({ queryKey: ['attendance', 'schedules'] });
        queryClient.invalidateQueries({ queryKey: ['attendance', 'shifts'] });
        setForm(emptyForm);
      } else {
        toast.error(t('attendanceAdmin.scheduleSaveFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.scheduleSaveFailed'))
  });

  const submit = () => {
    if (!form.name.trim()) {
      toast.error(t('attendanceAdmin.scheduleSaveFailed'));
      return;
    }
    mutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.schedulesTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.schedulesDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='sch-name'>{t('attendanceAdmin.scheduleName')}</Label>
            <Input id='sch-name' value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='sch-start'>{t('attendanceAdmin.startTime')}</Label>
            <Input
              id='sch-start'
              type='time'
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='sch-end'>{t('attendanceAdmin.endTime')}</Label>
            <Input
              id='sch-end'
              type='time'
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label>{t('attendanceAdmin.workingDay')}</Label>
          {form.weekdayRules.map((rule, i) => (
            <div
              key={rule.dayOfWeek}
              className='flex flex-wrap items-center gap-2 rounded-md border p-2'
            >
              <label className='flex w-16 items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={rule.isWorkingDay}
                  onChange={(e) => setRule(i, { isWorkingDay: e.target.checked })}
                />
                {t(DAY_I18N_KEYS[rule.dayOfWeek])}
              </label>
              <input
                type='time'
                value={rule.startTime}
                onChange={(e) => setRule(i, { startTime: e.target.value })}
                className='rounded-md border px-2 py-1 text-sm'
                disabled={!rule.isWorkingDay}
              />
              <input
                type='time'
                value={rule.endTime}
                onChange={(e) => setRule(i, { endTime: e.target.value })}
                className='rounded-md border px-2 py-1 text-sm'
                disabled={!rule.isWorkingDay}
              />
              <input
                type='number'
                min={0}
                value={rule.lateToleranceMinutes}
                onChange={(e) => setRule(i, { lateToleranceMinutes: Number(e.target.value) })}
                className='w-24 rounded-md border px-2 py-1 text-sm'
                placeholder={t('attendanceAdmin.lateTolerance')}
                disabled={!rule.isWorkingDay}
              />
              <input
                type='number'
                min={0}
                value={rule.absenceCutoffMinutes}
                onChange={(e) => setRule(i, { absenceCutoffMinutes: Number(e.target.value) })}
                className='w-24 rounded-md border px-2 py-1 text-sm'
                placeholder={t('attendanceAdmin.absenceCutoff')}
                disabled={!rule.isWorkingDay}
              />
            </div>
          ))}
        </div>

        <Button onClick={submit} disabled={mutation.isPending}>
          {t('attendanceAdmin.saveSchedule')}
        </Button>
      </CardContent>
    </Card>
  );
}
