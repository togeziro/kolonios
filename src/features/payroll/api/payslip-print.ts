import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { findPayrollRecordForPrint } from '@/lib/db/payroll';
import { getCompanyProfile } from './settings';
import { isStaffRole } from './shared';
import { payrollRecordIdSchema } from './validation';

export const getPayrollPayslipPrintFn = createServerFn({ method: 'GET' })
  .validator(payrollRecordIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    // The print slip carries the NPWP and the full bank account number, so it
    // is an admin/HR document. Staff roles keep their masked self-service
    // payslips page; staff and non-existing lookups both resolve to a null
    // record so the endpoint cannot probe other employees' payslips.
    if (isStaffRole(session.user.role)) {
      return JSON.parse(JSON.stringify({ company: getCompanyProfile(), record: null }));
    }
    const record = await findPayrollRecordForPrint({ id: data.id });
    return JSON.parse(JSON.stringify({ company: getCompanyProfile(), record }));
  });
