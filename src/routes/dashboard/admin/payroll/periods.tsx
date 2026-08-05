import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { payrollPeriodsQueryOptions } from '@/features/payroll/api/queries';
import { useCreatePayrollPeriod } from '@/features/payroll/api/mutations';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';

export const Route = createFileRoute('/dashboard/admin/payroll/periods')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: PeriodsPage
});

function PeriodsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canAdd = canPayrollAction(permissions, isAdmin, 'add');
  const {
    data: response,
    isLoading,
    isError
  } = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const data = Array.isArray(response) ? response : (response?.rows ?? []);
  const create = useCreatePayrollPeriod();
  const [form, setForm] = useState({ name: '', periodStart: '', periodEnd: '', paymentDate: '' });
  const save = async () => {
    if (
      !canAdd ||
      !form.name ||
      !form.periodStart ||
      !form.periodEnd ||
      !form.paymentDate ||
      form.periodEnd < form.periodStart
    )
      return toast.error(t('payroll.invalidPeriod'));
    try {
      await create.mutateAsync(form);
      toast.success(t('payroll.created'));
      setForm({ name: '', periodStart: '', periodEnd: '', paymentDate: '' });
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  return (
    <PageContainer
      pageTitle={t('payroll.periods')}
      pageDescription={t('payroll.periodsDescription')}
    >
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0'>
        <Card>
          <CardHeader>
            <CardTitle>{t('payroll.periods')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>{t('common.loading')}</p>
            ) : isError ? (
              <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
            ) : !data.length ? (
              <p className='text-sm text-muted-foreground'>{t('payroll.noPeriods')}</p>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payroll.name')}</TableHead>
                      <TableHead>{t('payroll.start')}</TableHead>
                      <TableHead>{t('payroll.end')}</TableHead>
                      <TableHead>{t('payroll.paymentDate')}</TableHead>
                      <TableHead>{t('payroll.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data ?? []).map((period) => (
                      <TableRow key={period.id}>
                        <TableCell>{period.name}</TableCell>
                        <TableCell>{period.period_start}</TableCell>
                        <TableCell>{period.period_end}</TableCell>
                        <TableCell>{period.payment_date}</TableCell>
                        <TableCell>
                          <Badge variant='outline'>{t(`payroll.statuses.${period.status}`)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('payroll.newPeriod')}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div>
              <Label>{t('payroll.name')}</Label>
              <Input
                className='w-full'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('payroll.start')}</Label>
              <Input
                className='w-full'
                type='date'
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('payroll.end')}</Label>
              <Input
                className='w-full'
                type='date'
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('payroll.paymentDate')}</Label>
              <Input
                className='w-full'
                type='date'
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              />
            </div>
            <Button onClick={save} disabled={!canAdd || create.isPending}>
              {t('common.save')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
