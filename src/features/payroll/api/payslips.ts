import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { getPrimaryBankAccount, listMyPayslips } from '@/lib/db/payroll';
import { getCompanyProfile } from './settings';
import { maskAccountNumber } from './shared';
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
        return {
          ...row,
          bank_name: bank?.bank_name ?? null,
          bank_account_number: maskAccountNumber(bank?.account_number)
        };
      })
    );
    return JSON.parse(JSON.stringify({ ...result, company: getCompanyProfile(), rows }));
  });
