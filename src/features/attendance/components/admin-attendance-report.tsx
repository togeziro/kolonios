import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  adminAttendanceReportQueryOptions,
  locationsQueryOptions,
  schedulesQueryOptions
} from '../api/queries';
import { exportAttendanceReportFn } from '../api/service';
import type { AdminAttendanceFilters, ExportFormat } from '../api/types';

const STATUS_OPTIONS = ['present', 'late', 'absent', 'excused', 'pending'] as const;

export function AdminAttendanceReport() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AdminAttendanceFilters>({ page: 1, limit: 50 });

  const { data, isFetching } = useQuery(adminAttendanceReportQueryOptions(filters));
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const { data: schedulesData } = useQuery(schedulesQueryOptions());

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => exportAttendanceReportFn({ data: { filters, format } }),
    onSuccess: (res) => {
      if (!res?.success || !res.content) {
        toast.error(t('attendanceAdmin.exportFailed'));
        return;
      }
      const blob =
        res.format === 'csv'
          ? new Blob([res.content], { type: res.mime })
          : new Blob([Uint8Array.from(atob(res.content), (c) => c.charCodeAt(0))], {
              type: res.mime
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-report.${res.ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error(t('attendanceAdmin.exportFailed'))
  });

  const records = data?.records ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.reportsTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.reportsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.startDate')}</Label>
            <Input
              type='date'
              value={filters.startDate ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))
              }
            />
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.endDate')}</Label>
            <Input
              type='date'
              value={filters.endDate ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
            />
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.locationName')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.locationId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  locationId: e.target.value ? Number(e.target.value) : undefined
                }))
              }
            >
              <option value=''>--</option>
              {(locationsData?.locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.scheduleName')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.shiftId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  shiftId: e.target.value ? Number(e.target.value) : undefined
                }))
              }
            >
              <option value=''>--</option>
              {(schedulesData?.shifts ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <Label>{t('attendance.statusLabel')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: (e.target.value as AdminAttendanceFilters['status']) || undefined
                }))
              }
            >
              <option value=''>--</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
            <Button
              key={format}
              variant='outline'
              size='sm'
              onClick={() => exportMutation.mutate(format)}
              disabled={exportMutation.isPending}
            >
              {t(`attendanceAdmin.export${format.toUpperCase()}`)}
            </Button>
          ))}
          <span className='ml-auto text-sm text-muted-foreground'>
            {t('attendanceAdmin.totalRecords', { count: data?.total ?? 0 })}
          </span>
        </div>

        {isFetching ? (
          <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
        ) : records.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('attendanceAdmin.noData')}</p>
        ) : (
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-muted/50 text-muted-foreground'>
                <tr>
                  <th className='p-3 font-medium'>{t('attendance.startDate')}</th>
                  <th className='p-3 font-medium'>{t('attendanceAdmin.employee')}</th>
                  <th className='p-3 font-medium'>{t('attendanceAdmin.department')}</th>
                  <th className='p-3 font-medium'>{t('attendance.shift')}</th>
                  <th className='p-3 font-medium'>{t('attendance.checkInLabel')}</th>
                  <th className='p-3 font-medium'>{t('attendance.checkOutLabel')}</th>
                  <th className='p-3 font-medium'>{t('attendance.statusLabel')}</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {records.map((r) => (
                  <tr key={r.attendance.id}>
                    <td className='p-3'>{r.attendance.date}</td>
                    <td className='p-3'>{r.employee?.full_name ?? r.attendance.user_id}</td>
                    <td className='p-3'>{r.department?.name ?? '-'}</td>
                    <td className='p-3'>{r.shift?.name ?? '-'}</td>
                    <td className='p-3'>{r.attendance.check_in_time ?? '-'}</td>
                    <td className='p-3'>{r.attendance.check_out_time ?? '-'}</td>
                    <td className='p-3'>{r.attendance.attendance_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
