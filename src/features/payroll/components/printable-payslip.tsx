import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PayslipData } from './payslip-template';

// Print isolation: hide the app shell, show only the slip. The route renders
// inside the dashboard layout, so a body-level visibility switch keyed off the
// slip marker keeps this working no matter what chrome wraps it.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  [data-print-slip], [data-print-slip] * { visibility: visible !important; }
  [data-print-slip] {
    position: absolute !important;
    top: 0 !important;
    left: 50% !important;
    transform: translateX(-50%);
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 24px !important;
    box-shadow: none !important;
  }
}
`;

const EARNINGS_TESTID = 'payslip-earnings';
const DEDUCTIONS_TESTID = 'payslip-deductions';
const TOTAL_RECEIVED_TESTID = 'payslip-total-received';
const ACCOUNT_NUMBER_TESTID = 'payslip-account-number';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function IdentityField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex gap-2'>
      <dt className='w-32 shrink-0 text-black/70'>{label}</dt>
      <dd className='font-medium'>{value}</dd>
    </div>
  );
}

function LineItemSection({
  testId,
  title,
  items,
  totalLabel,
  total
}: {
  testId: string;
  title: string;
  items: PayslipData['lineItems'];
  totalLabel: string;
  total: string;
}) {
  return (
    <section data-testid={testId}>
      <h3 className='text-sm font-semibold tracking-wide uppercase'>{title}</h3>
      <table className='mt-2 w-full text-sm'>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td className='py-1.5'>-</td>
            </tr>
          )}
          {items.map((item, index) => (
            <tr
              key={`${item.name}-${index}`}
              className='border-black/20 border-b border-dashed last:border-0'
            >
              <td className='py-1.5'>{item.name}</td>
              <td className='py-1.5 text-right tabular-nums'>{item.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className='border-black border-t font-semibold'>
            <td className='py-1.5'>{totalLabel}</td>
            <td className='py-1.5 text-right tabular-nums'>{total}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export function PrintablePayslip({
  payslip,
  periodRange
}: {
  payslip: PayslipData;
  periodRange?: string;
}) {
  const { t } = useTranslation();
  const earnings = payslip.lineItems.filter((item) => item.type === 'earning');
  const deductions = payslip.lineItems.filter((item) => item.type === 'deduction');
  const range = periodRange?.trim() || `${payslip.period.start} - ${payslip.period.end}`;
  const contactLine = [payslip.company.email, payslip.company.phone].filter(Boolean).join(' | ');
  return (
    <article
      data-print-slip
      className='text-black bg-white relative mx-auto w-full max-w-3xl space-y-5 p-8'
    >
      <style>{PRINT_CSS}</style>
      <header className='border-black border-b-2 pb-4 text-center'>
        <h1 className='text-lg font-bold uppercase'>{payslip.company.name}</h1>
        {payslip.company.address && <p className='text-sm'>{payslip.company.address}</p>}
        {contactLine && <p className='text-sm'>{contactLine}</p>}
      </header>
      <div className='text-center'>
        <h2 className='font-bold tracking-widest uppercase'>{t('payroll.payslipDocumentTitle')}</h2>
        <p className='text-sm'>{range}</p>
      </div>
      <dl className='gap-x-8 gap-y-2 border-black grid grid-cols-1 border-y py-3 text-sm sm:grid-cols-2'>
        <IdentityField label={t('payroll.employee')} value={payslip.employee.name} />
        <IdentityField label={t('payroll.employeeCode')} value={payslip.employee.code} />
        <IdentityField label={t('payroll.department')} value={payslip.employee.department ?? '-'} />
        <IdentityField
          label={t('employee.designation')}
          value={payslip.employee.designation ?? '-'}
        />
        <IdentityField label={t('payroll.npwp')} value={payslip.employee.npwp ?? '-'} />
        <IdentityField
          label={t('payroll.accountNumber')}
          value={
            payslip.bankAccount ? (
              <>
                {payslip.bankAccount.bankName ?? '-'} -{' '}
                <span data-testid={ACCOUNT_NUMBER_TESTID}>
                  {payslip.bankAccount.accountNumber ?? '-'}
                </span>
              </>
            ) : (
              '-'
            )
          }
        />
      </dl>
      <LineItemSection
        testId={EARNINGS_TESTID}
        title={t('payroll.earnings')}
        items={earnings}
        totalLabel={t('payroll.totalEarnings')}
        total={payslip.earningsTotal ?? payslip.gross}
      />
      <LineItemSection
        testId={DEDUCTIONS_TESTID}
        title={t('payroll.deductions')}
        items={deductions}
        totalLabel={t('payroll.totalDeduction')}
        total={payslip.deductions}
      />
      <section
        data-testid={TOTAL_RECEIVED_TESTID}
        className='border-black flex items-center justify-between border-y-2 px-3 py-3'
      >
        <span className='text-sm font-semibold uppercase'>{t('payroll.totalReceived')}</span>
        <span className='text-xl font-bold'>{payslip.net}</span>
      </section>
      <footer className='gap-6 grid grid-cols-2 pt-6 text-sm'>
        <div>
          <p>{t('payroll.printDate', { date: todayISO() })}</p>
          <p className='mt-10'>{t('payroll.approvedBy')}</p>
          <p className='border-black mt-16 border-t pt-1 font-medium'>{t('payroll.hrd')}</p>
        </div>
        <div>
          <p className='mt-10'>{t('payroll.receivedBy')}</p>
          <p className='border-black mt-[4.25rem] border-t pt-1 font-medium'>
            {payslip.employee.name}
          </p>
        </div>
      </footer>
      <div className='flex justify-center pt-4 print:hidden'>
        <Button type='button' onClick={() => window.print()}>
          {t('payroll.print')}
        </Button>
      </div>
    </article>
  );
}
