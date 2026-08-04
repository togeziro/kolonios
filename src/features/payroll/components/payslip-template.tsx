import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useTranslation } from 'react-i18next';

export interface PayslipData {
  company: { name: string; address?: string };
  employee: { code: string; name: string; department?: string | null; designation?: string | null };
  period: { name: string; start: string; end: string; status: 'paid' | 'locked' };
  gross: string;
  allowances: string;
  deductions: string;
  net: string;
  tax: string;
  bankAccount?: { bankName?: string | null; accountNumber?: string | null };
  lineItems: Array<{ name: string; type: 'earning' | 'deduction'; amount: string }>;
}

export type PayslipRecord = {
  id: number;
  payroll_period_id: number;
  details?: unknown;
  gross_salary: string;
  total_allowances: string;
  total_deductions: string;
  net_salary: string;
  employee_code?: string | null;
  employee_name?: string | null;
  department_name?: string | null;
  designation_name?: string | null;
  period_name?: string | null;
  period_start: string;
  period_end: string;
  period_status: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
};

const money = (value: number | string) =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function maskPayslipBankAccount(value: string) {
  return value.length > 4 ? `******${value.slice(-4)}` : '***';
}

function snapshotLineItems(details: Record<string, unknown>) {
  return Array.isArray(details.lineItems)
    ? details.lineItems.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const line = item as Record<string, unknown>;
        if (typeof line.name !== 'string' || typeof line.amount !== 'number') return [];
        return [
          {
            name: line.name,
            type:
              line.type === 'base' || line.type === 'allowance'
                ? ('earning' as const)
                : ('deduction' as const),
            amount: money(line.amount / 100)
          }
        ];
      })
    : [];
}

export function payslipFromRecord(row: PayslipRecord): PayslipData | null {
  if (row.period_status !== 'paid' && row.period_status !== 'locked') return null;
  const details =
    row.details && typeof row.details === 'object' ? (row.details as Record<string, unknown>) : {};
  const tax =
    details.tax && typeof details.tax === 'object' ? (details.tax as Record<string, unknown>) : {};
  return {
    company: { name: 'Kolonios' },
    employee: {
      code: row.employee_code ?? row.employee_name ?? 'Employee',
      name: row.employee_name ?? 'Employee',
      department: row.department_name,
      designation: row.designation_name
    },
    period: {
      name: row.period_name ?? `${row.period_start} - ${row.period_end}`,
      start: row.period_start,
      end: row.period_end,
      status: row.period_status
    },
    gross: money(row.gross_salary),
    allowances: money(row.total_allowances),
    deductions: money(row.total_deductions),
    net: money(row.net_salary),
    tax: money(typeof tax.amount === 'number' ? tax.amount / 100 : 0),
    bankAccount: row.bank_account_number
      ? { bankName: row.bank_name, accountNumber: maskPayslipBankAccount(row.bank_account_number) }
      : undefined,
    lineItems: snapshotLineItems(details)
  };
}

export function PayslipTemplate({ payslip }: { payslip: PayslipData }) {
  const { t } = useTranslation();
  return (
    <article className='bg-card text-card-foreground mx-auto max-w-3xl space-y-6 rounded-xl border p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none'>
      <header className='flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row'>
        <div>
          <h2 className='text-xl font-semibold'>{payslip.company.name}</h2>
          {payslip.company.address && (
            <p className='text-muted-foreground text-sm'>{payslip.company.address}</p>
          )}
        </div>
        <div className='text-left sm:text-right'>
          <p className='text-muted-foreground text-sm uppercase tracking-wide'>
            {t('payroll.payslips')}
          </p>
          <p className='font-medium'>{payslip.period.name}</p>
          <p className='text-muted-foreground text-xs'>
            {payslip.period.start} - {payslip.period.end}
          </p>
        </div>
      </header>
      <section className='grid gap-3 text-sm sm:grid-cols-2'>
        <div>
          <span className='text-muted-foreground'>{t('payroll.employee')}</span>
          <p className='font-medium'>{payslip.employee.name}</p>
        </div>
        <div>
          <span className='text-muted-foreground'>{t('payroll.employeeCode')}</span>
          <p className='font-medium'>{payslip.employee.code}</p>
        </div>
        <div>
          <span className='text-muted-foreground'>{t('payroll.department')}</span>
          <p>{payslip.employee.department ?? '-'}</p>
        </div>
        <div>
          <span className='text-muted-foreground'>{t('employee.designation')}</span>
          <p>{payslip.employee.designation ?? '-'}</p>
        </div>
      </section>
      <section className='overflow-x-auto'>
        <table className='w-full min-w-[30rem] text-sm'>
          <thead>
            <tr className='border-b text-left'>
              <th className='py-2'>{t('payroll.description')}</th>
              <th className='py-2 text-right'>{t('payroll.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {payslip.lineItems.map((item, index) => (
              <tr className='border-b last:border-0' key={`${item.name}-${index}`}>
                <td className='py-2'>{item.name}</td>
                <td className='py-2 text-right'>
                  {item.type === 'deduction' ? '-' : ''}
                  {item.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-2 text-sm'>
          <SummaryRow label={t('payroll.gross')} value={payslip.gross} />
          <SummaryRow label={t('payroll.allowances')} value={payslip.allowances} />
          <SummaryRow label={t('payroll.deductions')} value={payslip.deductions} />
          <SummaryRow label={t('payroll.tax')} value={payslip.tax} />
        </div>
        <div className='bg-primary/5 rounded-lg p-4'>
          <p className='text-muted-foreground text-sm'>{t('payroll.net')}</p>
          <p className='text-2xl font-semibold'>{payslip.net}</p>
        </div>
      </section>
      {payslip.bankAccount && (
        <p className='text-muted-foreground text-sm'>
          {`${t('payroll.bank')}:`} {payslip.bankAccount.bankName ?? '-'}{' '}
          <span className='font-medium'>
            {maskPayslipBankAccount(payslip.bankAccount.accountNumber ?? '')}
          </span>
        </p>
      )}
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-4'>
      <span className='text-muted-foreground'>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export async function createPayslipPdf(payslip: PayslipData) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, size = 10, isBold = false) => {
    page.drawText(text, {
      x: 40,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.12, 0.14, 0.18)
    });
    y -= size + 8;
  };
  draw(payslip.company.name, 18, true);
  draw(`Payslip: ${payslip.period.name}`, 12, true);
  draw(`${payslip.period.start} - ${payslip.period.end}`);
  y -= 8;
  draw(`${payslip.employee.name} (${payslip.employee.code})`);
  draw(
    `Gross ${payslip.gross}   Allowances ${payslip.allowances}   Deductions ${payslip.deductions}`
  );
  draw(`Tax ${payslip.tax}   Net pay ${payslip.net}`, 12, true);
  y -= 8;
  for (const item of payslip.lineItems)
    draw(`${item.name}: ${item.type === 'deduction' ? '-' : ''}${item.amount}`);
  if (payslip.bankAccount)
    draw(
      `Bank: ${payslip.bankAccount.bankName ?? '-'} ${maskPayslipBankAccount(payslip.bankAccount.accountNumber ?? '')}`
    );
  return {
    bytes: await document.save(),
    filename: `payslip-${payslip.employee.code}-${payslip.period.start.slice(0, 7)}.pdf`
  };
}
