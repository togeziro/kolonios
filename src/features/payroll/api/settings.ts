import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { companyPayrollSettings } from '@/lib/db/schema/payroll';
import { getCompanyPayrollSettings, withPayrollAuditTransaction } from '@/lib/db/payroll';
import { companyPayrollSettingsSchema } from './validation';

export interface CompanyProfile {
  name: string;
  address?: string;
}

export function getCompanyProfile(): CompanyProfile {
  const name = process.env.COMPANY_NAME?.trim();
  const address = process.env.COMPANY_ADDRESS?.trim();
  return {
    name: name || 'Kolonios',
    ...(address ? { address } : {})
  };
}

export const getCompanyPayrollSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('payroll', 'edit');
  return JSON.parse(JSON.stringify(await getCompanyPayrollSettings()));
});

export const updateCompanyPayrollSettingsFn = createServerFn({ method: 'POST' })
  .validator(companyPayrollSettingsSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.company_settings.update', entityType: 'company_payroll_settings' },
      async (tx) => {
        const existing = await tx.select().from(companyPayrollSettings).limit(1);
        if (existing.length === 0) await tx.insert(companyPayrollSettings).values({});
        const [row] = await tx
          .update(companyPayrollSettings)
          .set({
            company_npwp: data.companyNpwp,
            cut_off_day: data.cutOffDay,
            pph21_enabled: data.pph21Enabled,
            pph21_method: data.pph21Method,
            jkk_enabled: data.jkkEnabled,
            jkm_enabled: data.jkmEnabled,
            jht_enabled: data.jhtEnabled,
            jp_enabled: data.jpEnabled,
            bpjs_kesehatan_enabled: data.bpjsKesehatanEnabled,
            jkk_risk_category: data.jkkRiskCategory,
            jkm_company_rate: data.jkmCompanyRate,
            jht_company_rate: data.jhtCompanyRate,
            jht_employee_rate: data.jhtEmployeeRate,
            jp_company_rate: data.jpCompanyRate,
            jp_employee_rate: data.jpEmployeeRate,
            kesehatan_company_rate: data.kesehatanCompanyRate,
            kesehatan_employee_rate: data.kesehatanEmployeeRate,
            potongan_izin_jam_default: data.potonganIzinJamDefault,
            potongan_shortfall_default: data.potonganShortfallDefault,
            updated_at: new Date()
          })
          .returning();
        if (!row) throw new DomainError('Failed to update company payroll settings.');
        return row;
      }
    );
    return updated;
  });
