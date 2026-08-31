export interface CompanyProfile {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface CompanyProfileColumns {
  company_name?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
}

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Resolves the Company Profile through the agreed fallback chain:
 * database (company settings) first, then the deployment's COMPANY_*
 * environment variables, then the product default. `process.env` is
 * read lazily so the chain also works in edge/serverless contexts.
 */
export function resolveCompanyProfile(
  row: CompanyProfileColumns | null | undefined,
  env: Record<string, string | undefined> = process.env
): CompanyProfile {
  const name = clean(row?.company_name) ?? clean(env.COMPANY_NAME) ?? 'Kolonios';
  const address = clean(row?.company_address) ?? clean(env.COMPANY_ADDRESS);
  const email = clean(row?.company_email) ?? clean(env.COMPANY_EMAIL);
  const phone = clean(row?.company_phone) ?? clean(env.COMPANY_PHONE);
  return {
    name,
    ...(address ? { address } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {})
  };
}
