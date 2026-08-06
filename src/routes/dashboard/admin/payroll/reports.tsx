import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import {
  payrollPeriodsQueryOptions,
  payrollReportQueryOptions
} from '@/features/payroll/api/queries';
import { getPayrollReportFn } from '@/features/payroll/api/service';
import type { PayrollReportResult } from '@/features/payroll/api/types';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { formatPayrollMoney } from './-components';
import { decodePayrollExport } from './-reports-download';

export const Route = createFileRoute('/dashboard/admin/payroll/reports')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.reports' });
  },
  component: ReportsPage
});

function ReportsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canReports = canPayrollAction(permissions, isAdmin, 'reports');
  const [periodId, setPeriodId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const hasScope = Boolean(periodId || departmentId);
  const periodsQuery = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const departmentsQuery = useQuery(departmentsQueryOptions());
  const reportQuery = useQuery({
    ...payrollReportQueryOptions({
      payrollPeriodId: periodId ? Number(periodId) : undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
      format: 'json'
    }),
    enabled: hasScope
  });
  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') =>
      getPayrollReportFn({
        data: {
          payrollPeriodId: periodId ? Number(periodId) : undefined,
          departmentId: departmentId ? Number(departmentId) : undefined,
          format
        }
      }),
    onSuccess: (rawResult) => {
      const result = rawResult as unknown as {
        content?: string;
        encoding?: 'identity' | 'base64';
        mime?: string;
        ext?: string;
      };
      if (!result || !('content' in result)) return;
      if (!result.content || !result.encoding || !result.mime || !result.ext) return;
      const bytes = decodePayrollExport(result.content, result.encoding);
      const blob = new Blob([bytes], { type: result.mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payroll-report.${result.ext}`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  });
  const report = reportQuery.data as unknown as PayrollReportResult | undefined;
  const periods = periodsQuery.data?.rows ?? [];
  return (
    <PageContainer
      pageTitle={t('payroll.reports')}
      pageDescription={t('payroll.reportsDescription')}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.reports')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <label htmlFor='report-period' className='text-sm font-medium'>
                {t('payroll.periods')}
              </label>
              <NativeSelect
                id='report-period'
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value=''>{t('common.all')}</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor='report-department' className='text-sm font-medium'>
                {t('payroll.department')}
              </label>
              <NativeSelect
                id='report-department'
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value=''>{t('common.all')}</option>
                {(departmentsQuery.data?.departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              disabled={!canReports || !hasScope || exportMutation.isPending}
              onClick={() => exportMutation.mutate('csv')}
            >
              {t('payroll.exportCsv')}
            </Button>
            <Button
              variant='outline'
              disabled={!canReports || !hasScope || exportMutation.isPending}
              onClick={() => exportMutation.mutate('xlsx')}
            >
              {t('payroll.exportXlsx')}
            </Button>
          </div>
          {hasScope && (
            <p className='text-xs text-muted-foreground'>{t('payroll.reportScopeHint')}</p>
          )}
          {!hasScope ? (
            <p className='text-sm text-muted-foreground'>{t('payroll.selectReportScope')}</p>
          ) : reportQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
          ) : reportQuery.isError ? (
            <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
          ) : !report?.rows.length ? (
            <p className='text-sm text-muted-foreground'>{t('payroll.noReportData')}</p>
          ) : (
            <>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
                {[
                  ['gross', report.gross],
                  ['allowances', report.allowances],
                  ['deductions', report.deductions],
                  ['net', report.net],
                  ['taxTotal', report.taxTotal]
                ].map(([key, value]) => (
                  <div className='rounded-lg border p-4' key={key as string}>
                    <p className='text-sm text-muted-foreground'>{t(`payroll.${key}`)}</p>
                    <p className='text-xl font-semibold'>{formatPayrollMoney(Number(value))}</p>
                  </div>
                ))}
              </div>
              <div className='grid gap-4 lg:grid-cols-2'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.departmentTotals')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('payroll.department')}</TableHead>
                            <TableHead>{t('payroll.gross')}</TableHead>
                            <TableHead>{t('payroll.net')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.departmentTotals.map((row) => (
                            <TableRow key={row.department}>
                              <TableCell>{row.department}</TableCell>
                              <TableCell>{formatPayrollMoney(row.gross)}</TableCell>
                              <TableCell>{formatPayrollMoney(row.net)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.componentTotals')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('payroll.name')}</TableHead>
                            <TableHead>{t('payroll.type')}</TableHead>
                            <TableHead>{t('payroll.amount')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.componentTotals.map((row) => (
                            <TableRow key={`${row.type}-${row.name}`}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{t(`payroll.${row.type}`)}</TableCell>
                              <TableCell>{formatPayrollMoney(row.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
