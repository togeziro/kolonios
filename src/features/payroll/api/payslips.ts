import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { getPrimaryBankAccount, listMyPayslips } from '@/lib/db/payroll';
import { getCompanyProfile } from './settings';
import { myPayslipFiltersSchema } from './validation';

export const getMyPayslipsFn = createServerFn({ method: 'GET' })
  .validator(myPayslipFiltersSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    const result = await listMyPayslips(session.user.id, {
      payroll_period_id: data.payrollPeriodId,
      page: data.page,
      limit: data.limit
    });
    const rows = await Promise.all(
      result.rows.map(async (row) => {
        const bank = await getPrimaryBankAccount(session.user.id, row.period_end);
        const accountNumber = bank?.account_number ?? '';
        return {
          ...row,
          bank_name: bank?.bank_name ?? null,
          bank_account_number: accountNumber ? `******${accountNumber.slice(-4)}` : null
        };
      })
    );
    return JSON.parse(JSON.stringify({ ...result, company: getCompanyProfile(), rows }));
  });
