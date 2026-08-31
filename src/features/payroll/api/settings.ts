import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { companyPayrollSettings } from '@/lib/db/schema/payroll';
import { getCompanyPayrollSettings, withPayrollAuditTransaction } from '@/lib/db/payroll';
import { resolveCompanyProfile, type CompanyProfile } from '@/lib/branding/company-profile';
import { stripPngDataUrl } from '@/lib/branding/assets';
import { companyPayrollSettingsSchema } from './validation';

export type { CompanyProfile };

const envCompanyProfile = (): CompanyProfile => resolveCompanyProfile(null);

/**
 * Company Profile for payslip documents: reads the Branding database row and
 * falls back to the deployment's COMPANY_* env vars when unset (the agreed
 * fallback chain in src/lib/branding/company-profile.ts).
 */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  try {
    const { getCompanyBranding } = await import('@/lib/db/branding');
    const branding = await getCompanyBranding();
    return resolveCompanyProfile(branding.profile);
  } catch {
    // DB hiccup must never block a payslip render — env chain still applies.
    return envCompanyProfile();
  }
}

/**
 * Base64 payload of the Branding light logo for embedding in payslip
 * documents. Payslips render on white, so the light variant is always the
 * right one. Null-safe: returns undefined when unset or on DB failure.
 */
export async function getCompanyLogoBase64(): Promise<string | undefined> {
  try {
    const { getCompanyBranding } = await import('@/lib/db/branding');
    const { logoLight } = await getCompanyBranding();
    return stripPngDataUrl(logoLight);
  } catch {
    return undefined;
  }
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
