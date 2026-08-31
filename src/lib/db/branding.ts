import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { companySettings } from '@/lib/db/schema/masterdata';
import type { CompanySetting } from '@/lib/db/schema/masterdata';
import { withAudit } from '@/lib/audit';
import type { CompanyProfileColumns } from '@/lib/branding/company-profile';

export interface CompanyBranding {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  profile: CompanyProfileColumns;
}

export interface CompanyBrandingUpdate {
  logoLight?: string | null;
  logoDark?: string | null;
  favicon?: string | null;
  profile?: {
    name?: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

const toProfile = (row: CompanySetting | null): CompanyProfileColumns => ({
  company_name: row?.company_name ?? null,
  company_address: row?.company_address ?? null,
  company_email: row?.company_email ?? null,
  company_phone: row?.company_phone ?? null
});

const toBranding = (row: CompanySetting | null): CompanyBranding => ({
  logoLight: row?.branding_logo_light ?? null,
  logoDark: row?.branding_logo_dark ?? null,
  favicon: row?.branding_favicon ?? null,
  profile: toProfile(row)
});

const toSnapshot = (row: CompanySetting | null) => ({
  logoLight: markAsset(row?.branding_logo_light),
  logoDark: markAsset(row?.branding_logo_dark),
  favicon: markAsset(row?.branding_favicon),
  profile: toProfile(row)
});

// Audit rows must stay small: log set/unset/changed instead of the full
// base64 payload (~700 KB per slot would bloat the audit log).
function markAsset(value: string | null | undefined): 'set' | null {
  return value ? 'set' : null;
}

async function getSingletonRow(): Promise<CompanySetting | null> {
  const [row] = await db.select().from(companySettings).limit(1);
  return row ?? null;
}

export async function getCompanyBranding(): Promise<CompanyBranding> {
  const row = await getSingletonRow();
  return toBranding(row);
}

/**
 * Applies a partial Branding update to the singleton settings row (created
 * on first save) and records one audit entry capturing the before/after
 * branding state. Slots are overwritten — the Asset Slot model keeps no
 * version history.
 */
export async function updateCompanyBranding(
  actorUserId: string,
  update: CompanyBrandingUpdate
): Promise<CompanyBranding> {
  const before = await getSingletonRow();
  const after = await withAudit(
    actorUserId,
    {
      action: 'branding.update',
      entityType: 'company_settings',
      entityId: before?.id,
      before: toSnapshot(before),
      after: {
        logoLight: update.logoLight !== undefined ? markAsset(update.logoLight) : undefined,
        logoDark: update.logoDark !== undefined ? markAsset(update.logoDark) : undefined,
        favicon: update.favicon !== undefined ? markAsset(update.favicon) : undefined,
        profile: {
          company_name: update.profile?.name ?? before?.company_name ?? null,
          company_address: update.profile?.address ?? before?.company_address ?? null,
          company_email: update.profile?.email ?? before?.company_email ?? null,
          company_phone: update.profile?.phone ?? before?.company_phone ?? null
        }
      }
    },
    async () => {
      const row = before ?? (await db.insert(companySettings).values({}).returning())[0];
      if (!row) throw new Error('Failed to create company settings row');
      const [updated] = await db
        .update(companySettings)
        .set({
          ...(update.logoLight !== undefined ? { branding_logo_light: update.logoLight } : {}),
          ...(update.logoDark !== undefined ? { branding_logo_dark: update.logoDark } : {}),
          ...(update.favicon !== undefined ? { branding_favicon: update.favicon } : {}),
          ...(update.profile?.name !== undefined ? { company_name: update.profile.name } : {}),
          ...(update.profile?.address !== undefined
            ? { company_address: update.profile.address }
            : {}),
          ...(update.profile?.email !== undefined ? { company_email: update.profile.email } : {}),
          ...(update.profile?.phone !== undefined ? { company_phone: update.profile.phone } : {}),
          updated_at: new Date()
        })
        .where(eq(companySettings.id, row.id))
        .returning();
      if (!updated) throw new Error('Failed to update company branding');
      return updated;
    }
  );

  return toBranding(after);
}
