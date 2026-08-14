import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import { appFeatures } from '@/lib/table-features';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { DataTable } from '@/components/ui/table/data-table';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  adminAttendanceReportQueryOptions,
  locationsQueryOptions,
  schedulesQueryOptions
} from '../api/queries';
import { exportAttendanceReportFn } from '../api/service';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import type { AdminAttendanceFilters, ExportFormat } from '../api/types';
import { adminAttendanceColumns } from './admin-attendance-columns';

const STATUS_OPTIONS = ['present', 'late', 'absent', 'excused', 'pending'] as const;

export function AdminAttendanceReport() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AdminAttendanceFilters>({ page: 1, limit: 50 });

  const { data, isFetching } = useQuery(adminAttendanceReportQueryOptions(filters));
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const { data: schedulesData } = useQuery(schedulesQueryOptions());
  const { data: departmentsData } = useQuery(departmentsQueryOptions());
  const { data: employeesData } = useQuery(employeesQueryOptions({ limit: 100 }));

  const limit = filters.limit ?? 50;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const currentPage = filters.page ?? 1;

  const setFilter = (patch: Partial<AdminAttendanceFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

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

  const table = useTable({
    features: appFeatures,
    data: records,
    columns: adminAttendanceColumns,
    manualPagination: true,
    pageCount: totalPages,
    state: {
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: limit
      }
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: currentPage - 1, pageSize: limit })
          : updater;
      setFilters((f) => ({
        ...f,
        page: next.pageIndex + 1,
        limit: next.pageSize
      }));
    }
  });

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
            <DatePicker
              value={filters.startDate ?? ''}
              onChange={(date) => setFilter({ startDate: date ?? undefined })}
            />
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.endDate')}</Label>
            <DatePicker
              value={filters.endDate ?? ''}
              onChange={(date) => setFilter({ endDate: date ?? undefined })}
            />
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.department')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.departmentId ?? ''}
              onChange={(e) =>
                setFilter({
                  departmentId: e.target.value ? Number(e.target.value) : undefined
                })
              }
            >
              <option value=''>--</option>
              {(departmentsData?.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.employee')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.userId ?? ''}
              onChange={(e) => setFilter({ userId: e.target.value || undefined })}
            >
              <option value=''>--</option>
              {(employeesData?.employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <Label>{t('attendanceAdmin.locationName')}</Label>
            <select
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
              value={filters.locationId ?? ''}
              onChange={(e) =>
                setFilter({
                  locationId: e.target.value ? Number(e.target.value) : undefined
                })
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
                setFilter({
                  shiftId: e.target.value ? Number(e.target.value) : undefined
                })
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
                setFilter({
                  status: (e.target.value as AdminAttendanceFilters['status']) || undefined
                })
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
          <DataTable table={table} />
        )}
      </CardContent>
    </Card>
  );
}
