import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { myPayslipsQueryOptions } from '@/features/payroll/api/queries';
import { PayslipDownload } from '@/features/payroll/components/payslip-download';
import {
  PayslipTemplate,
  payslipFromRecord,
  type PayslipRecord
} from '@/features/payroll/components/payslip-template';

export const Route = createFileRoute('/dashboard/payroll/payslips')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payslips.view' });
  },
  component: PayslipsPage
});

function PayslipsPage() {
  const { t } = useTranslation();
  const [periodId, setPeriodId] = useState<number | undefined>();
  const query = useQuery(myPayslipsQueryOptions({ payrollPeriodId: periodId, page: 1, limit: 50 }));
  const rows = (query.data?.rows ?? []) as PayslipRecord[];
  const company = query.data?.company;
  const companyLogo = query.data?.companyLogo;
  const payslips = rows.flatMap((row) => {
    if (!company) return [];
    const payslip = payslipFromRecord(row, company, { companyLogo });
    return payslip ? [{ row, payslip }] : [];
  });
  const periods = [...new Map(rows.map((row) => [row.payroll_period_id, row])).values()];

  return (
    <PageContainer
      pageTitle={t('payroll.payslips')}
      pageDescription={t('payroll.payslipsDescription')}
    >
      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle>{t('payroll.payslips')}</CardTitle>
          <select
            aria-label={t('payroll.selectPeriod')}
            className='rounded-md border bg-background px-3 py-2 text-sm'
            value={periodId ?? ''}
            onChange={(event) =>
              setPeriodId(event.target.value ? Number(event.target.value) : undefined)
            }
          >
            <option value=''>{t('common.all')}</option>
            {periods.map((period) => (
              <option key={period.payroll_period_id} value={period.payroll_period_id}>
                {period.period_name}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className='text-muted-foreground text-sm'>{t('common.loading')}</p>
          ) : query.isError ? (
            <p className='text-destructive text-sm'>{t('payroll.payslipsLoadFailed')}</p>
          ) : payslips.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('payroll.noPayslips')}</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[42rem] text-sm'>
                <thead>
                  <tr className='border-b text-left'>
                    <th className='p-2'>{t('payroll.periods')}</th>
                    <th className='p-2'>{t('payroll.status')}</th>
                    <th className='p-2 text-right'>{t('payroll.net')}</th>
                    <th className='p-2 text-right'>{t('payroll.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(({ row, payslip }) => (
                    <tr className='border-b' key={row.id}>
                      <td className='p-2'>{payslip.period.name}</td>
                      <td className='p-2'>{t(`payroll.statuses.${payslip.period.status}`)}</td>
                      <td className='p-2 text-right'>{payslip.net}</td>
                      <td className='p-2'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() =>
                              document
                                .getElementById(`payslip-${row.id}`)
                                ?.scrollIntoView({ behavior: 'smooth' })
                            }
                          >
                            {t('common.view')}
                          </Button>
                          <PayslipDownload payslip={payslip} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {payslips.map(({ row, payslip }) => (
        <div className='mt-6' id={`payslip-${row.id}`} key={row.id}>
          <PayslipTemplate payslip={payslip} />
        </div>
      ))}
    </PageContainer>
  );
}
