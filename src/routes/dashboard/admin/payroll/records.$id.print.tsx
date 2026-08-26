import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { payslipPrintQueryOptions } from '@/features/payroll/api/queries';
import type { CompanyProfile } from '@/features/payroll/api/settings';
import {
  payslipFromRecord,
  type PayslipRecord
} from '@/features/payroll/components/payslip-template';
import { PrintablePayslip } from '@/features/payroll/components/printable-payslip';

export const Route = createFileRoute('/dashboard/admin/payroll/records/$id/print')({
  head: () => ({ meta: [{ title: 'Dashboard: Print Payslip' }] }),
  ssr: 'data-only',
  validateSearch: (search: Record<string, unknown>) => ({
    start: typeof search.start === 'string' ? search.start : undefined,
    end: typeof search.end === 'string' ? search.end : undefined
  }),
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  loader: async ({ context: { queryClient }, params }) => {
    const recordId = Number.parseInt(params.id, 10);
    if (Number.isInteger(recordId) && recordId > 0) {
      await queryClient.ensureQueryData(payslipPrintQueryOptions(recordId));
    }
  },
  component: PayslipPrintRoute
});

type PayslipPrintPayload = {
  company?: CompanyProfile;
  record?: PayslipRecord | null;
};

function PayslipPrintRoute() {
  const { t } = useTranslation();
  const params = Route.useParams();
  const search = Route.useSearch();
  const recordId = Number.parseInt(params.id, 10);
  const validRecordId = Number.isInteger(recordId) && recordId > 0;
  const query = useQuery({ ...payslipPrintQueryOptions(recordId), enabled: validRecordId });
  const payload = query.data as PayslipPrintPayload | undefined;
  const record = payload?.record ?? null;
  const company = payload?.company;
  const payslip =
    company && record ? payslipFromRecord(record, company, { maskBankAccount: false }) : null;
  const periodRange =
    search.start || search.end
      ? [search.start ?? record?.period_start, search.end ?? record?.period_end]
          .filter(Boolean)
          .join(' - ')
      : undefined;

  let body = <p className='text-muted-foreground text-sm'>{t('common.loading')}</p>;
  if (query.isError || (!query.isLoading && !validRecordId)) {
    body = <p className='text-destructive text-sm'>{t('payroll.loadFailed')}</p>;
  } else if (!query.isLoading && !payslip) {
    body = (
      <div className='bg-card rounded-xl border p-6'>
        <p className='text-destructive text-sm'>{t('payroll.payslipNotAvailable')}</p>
      </div>
    );
  } else if (payslip) {
    body = <PrintablePayslip payslip={payslip} periodRange={periodRange} />;
  }

  return (
    <PageContainer
      pageTitle={t('payroll.payslips')}
      pageDescription={
        record ? `${record.employee_name ?? ''} · ${record.period_name ?? ''}` : undefined
      }
    >
      {body}
    </PageContainer>
  );
}
