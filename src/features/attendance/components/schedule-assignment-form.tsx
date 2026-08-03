import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { schedulesQueryOptions } from '../api/queries';
import { assignScheduleFn, bulkAssignScheduleFn, createDayOffFn } from '../api/service';

export function ScheduleAssignmentForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Bulk assignment covers up to the configured employee list limit (100).
  const { data: employees } = useQuery(employeesQueryOptions({ limit: 100 }));
  const { data: schedules } = useQuery(schedulesQueryOptions());

  const employeeRows = employees?.employees ?? [];
  const scheduleRows = schedules?.shifts ?? [];

  const [userId, setUserId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dayOffUserId, setDayOffUserId] = useState('');
  const [dayOffDate, setDayOffDate] = useState(new Date().toISOString().slice(0, 10));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance', 'assignments'] });
  };

  const assignMutation = useMutation({
    mutationFn: () =>
      assignScheduleFn({
        data: { userId, shiftId: Number(shiftId), effectiveFrom }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.assignmentCreated'));
        invalidate();
      } else {
        toast.error(t('attendanceAdmin.assignmentFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.assignmentFailed'))
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkAssignScheduleFn({
        data: {
          assignments: employeeRows.map((e) => ({
            userId: e.id,
            shiftId: Number(shiftId),
            effectiveFrom
          }))
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(`${t('attendanceAdmin.assignmentCreated')} (${res.count})`);
        invalidate();
      } else {
        toast.error(t('attendanceAdmin.assignmentFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.assignmentFailed'))
  });

  const runBulk = () => {
    if (employeeRows.length === 0 || !shiftId) return;
    if (!window.confirm(`${t('attendanceAdmin.bulkAssign')}: ${employeeRows.length}`)) return;
    bulkMutation.mutate();
  };

  const dayOffMutation = useMutation({
    mutationFn: () => createDayOffFn({ data: { userId: dayOffUserId, date: dayOffDate } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.dayOffCreated'));
      } else {
        toast.error(t('attendanceAdmin.assignmentFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.assignmentFailed'))
  });

  const canAssign = userId && shiftId && effectiveFrom;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.assignmentsTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.assignmentsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='as-employee'>{t('attendanceAdmin.employee')}</Label>
            <select
              id='as-employee'
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value=''>--</option>
              {employeeRows.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='as-shift'>{t('attendanceAdmin.scheduleName')}</Label>
            <select
              id='as-shift'
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value=''>--</option>
              {scheduleRows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='as-from'>{t('attendanceAdmin.effectiveFrom')}</Label>
            <Input
              id='as-from'
              type='date'
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
        </div>

        <div className='flex gap-2'>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!canAssign || assignMutation.isPending}
          >
            {t('attendanceAdmin.assignSchedule')}
          </Button>
          <Button variant='outline' onClick={runBulk} disabled={!shiftId || bulkMutation.isPending}>
            {t('attendanceAdmin.bulkAssign')}
          </Button>
        </div>

        <div className='rounded-md border p-4'>
          <h3 className='mb-3 text-sm font-medium'>{t('attendanceAdmin.dayOff')}</h3>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='do-employee'>{t('attendanceAdmin.employee')}</Label>
              <select
                id='do-employee'
                className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                value={dayOffUserId}
                onChange={(e) => setDayOffUserId(e.target.value)}
              >
                <option value=''>--</option>
                {employeeRows.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name ?? e.email}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='do-date'>{t('attendanceAdmin.startDate')}</Label>
              <Input
                id='do-date'
                type='date'
                value={dayOffDate}
                onChange={(e) => setDayOffDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant='outline'
            className='mt-3'
            onClick={() => dayOffMutation.mutate()}
            disabled={!dayOffUserId || dayOffMutation.isPending}
          >
            {t('attendanceAdmin.createDayOff')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
