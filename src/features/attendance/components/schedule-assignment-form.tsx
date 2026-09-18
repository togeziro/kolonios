import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import {
  schedulesQueryOptions,
  missingEmployeeProfilesQueryOptions,
  attendanceKeys
} from '../api/queries';
// Cross-feature invalidation (same allowance as schedule-grid's
// `write-mutations.ts`): writes here must refresh the admin grid and My
// Schedule, which live under different key namespaces.
import { scheduleGridKeys } from '@/features/schedule-grid/api/queries';
import { scheduleKeys } from '@/features/schedule/api/queries';
import { assignScheduleFn, bulkAssignScheduleFn, createDayOffFn } from '../api/service';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canAttendanceAdminAction } from './permissions';

export function ScheduleAssignmentForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canAdd = canAttendanceAdminAction(permissions, isAdmin, 'add');

  // Bulk assignment covers up to the configured employee list limit (100).
  const { data: employees } = useQuery(employeesQueryOptions({ limit: 100 }));
  const { data: schedules } = useQuery(schedulesQueryOptions());
  const { data: missing } = useQuery(missingEmployeeProfilesQueryOptions());

  const employeeRows = employees?.employees ?? [];
  const scheduleRows = schedules?.shifts ?? [];
  const missingCount = missing?.count ?? 0;

  const [userId, setUserId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  // Bounded assignments only: the end date is required (no open-ended rows).
  const [effectiveTo, setEffectiveTo] = useState('');
  const [dayOffUserId, setDayOffUserId] = useState('');
  const [dayOffDate, setDayOffDate] = useState(new Date().toISOString().slice(0, 10));

  // Every write here (assignment or day-off) changes what the admin
  // schedule grid and My Schedule resolve, but those pages query under
  // `scheduleGridKeys` / `scheduleKeys` — without this cross-namespace
  // invalidation the grid keeps showing stale cells until the week filter
  // changes (new query key → refetch).
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: scheduleGridKeys.all });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    queryClient.invalidateQueries({ queryKey: attendanceKeys.dayOffs() });
    queryClient.invalidateQueries({ queryKey: attendanceKeys.effectiveSchedule() });
    queryClient.invalidateQueries({ queryKey: attendanceKeys.assignments({}) });
  };

  // NOTE: assignments are always bounded — both mutations below send the
  // required `effectiveTo`. The `effectiveToRequired` / `effectiveTo <=
  // effectiveFrom` guards in `assignScheduleFn` / `bulkAssignScheduleFn`
  // exist for API/other-caller safety (see the tuple convention in
  // `src/features/attendance/api/service.ts`).
  const assignMutation = useMutation({
    mutationFn: () =>
      assignScheduleFn({
        data: { userId, shiftId: Number(shiftId), effectiveFrom, effectiveTo }
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
            effectiveFrom,
            effectiveTo
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
        invalidate();
      } else {
        toast.error(t('attendanceAdmin.assignmentFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.assignmentFailed'))
  });

  const canAssign = userId && shiftId && effectiveFrom && effectiveTo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.assignmentsTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.assignmentsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {missingCount > 0 && (
          <Alert>
            <Icons.alertCircle />
            <AlertTitle>
              {t('attendanceAdmin.missingProfilesAlertTitle', { count: missingCount })}
            </AlertTitle>
            <AlertDescription>
              <p className='mb-2'>{t('attendanceAdmin.missingProfilesAlertBody')}</p>
              {missing && missing.sample.length > 0 && (
                <ul className='mb-2 list-disc space-y-1 pl-5 text-sm'>
                  {missing.sample.map((u) => (
                    <li key={u.email ?? u.name}>
                      <div className='font-medium'>{u.name || u.email}</div>
                      {u.name && u.email ? (
                        <div className='text-muted-foreground text-xs'>{u.email}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant='outline' size='sm'>
                <Link to='/dashboard/employees'>{t('attendanceAdmin.openEmployees')}</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
            <Label htmlFor='as-shift'>{t('attendanceAdmin.shiftName')}</Label>
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
            <DatePicker
              id='as-from'
              value={effectiveFrom}
              onChange={(date) => setEffectiveFrom(date ?? '')}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='as-to'>
              {t('attendanceAdmin.effectiveTo')}
              <span className='text-destructive'> *</span>
            </Label>
            <DatePicker
              id='as-to'
              value={effectiveTo}
              onChange={(date) => setEffectiveTo(date ?? '')}
              minDate={effectiveFrom || undefined}
              className={!effectiveTo ? 'border-amber-400 ring-2 ring-amber-300/40' : undefined}
            />
            <p className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'>
              {t('attendanceAdmin.effectiveToHint')}
            </p>
          </div>
        </div>

        {canAdd && (
          <div className='flex gap-2'>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!canAssign || assignMutation.isPending}
            >
              {t('attendanceAdmin.assignSchedule')}
            </Button>
            <Button
              variant='outline'
              onClick={runBulk}
              disabled={!shiftId || bulkMutation.isPending}
            >
              {t('attendanceAdmin.bulkAssign')}
            </Button>
          </div>
        )}

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
              <DatePicker
                id='do-date'
                value={dayOffDate}
                onChange={(date) => setDayOffDate(date ?? '')}
              />
            </div>
          </div>
          {canAdd && (
            <Button
              variant='outline'
              className='mt-3'
              onClick={() => dayOffMutation.mutate()}
              disabled={!dayOffUserId || dayOffMutation.isPending}
            >
              {t('attendanceAdmin.createDayOff')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
