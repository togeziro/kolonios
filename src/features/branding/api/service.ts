import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  decodeBase64,
  stripPngDataUrl,
  validateBrandingImage,
  type BrandingSlot
} from '@/lib/branding/assets';
import { resolveCompanyProfile } from '@/lib/branding/company-profile';
import { updateBrandingSchema } from './validation';
import type { UpdateBrandingInput } from './validation';

export interface BrandingSettings {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  profile: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
}

const toSettings = (branding: {
  logoLight: string | null;
  logoDark: string | null;
  favicon: string | null;
  profile: {
    company_name?: string | null;
    company_address?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
  };
}): BrandingSettings => ({
  logoLight: branding.logoLight,
  logoDark: branding.logoDark,
  favicon: branding.favicon,
  profile: {
    name: branding.profile.company_name ?? '',
    address: branding.profile.company_address ?? '',
    email: branding.profile.company_email ?? '',
    phone: branding.profile.company_phone ?? ''
  }
});

export const getBrandingSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BrandingSettings> => {
    await requirePermission('settings', 'view');
    const { getCompanyBranding } = await import('@/lib/db/branding');
    return toSettings(await getCompanyBranding());
  }
);

const decodeDataUrl = (dataUrl: string): Uint8Array | null =>
  decodeBase64(stripPngDataUrl(dataUrl) ?? '');

const SLOT_BY_KEY = {
  logoLight: 'logo_light',
  logoDark: 'logo_dark',
  favicon: 'favicon'
} as const satisfies Record<
  keyof Pick<UpdateBrandingInput, 'logoLight' | 'logoDark' | 'favicon'>,
  BrandingSlot
>;

// Transport shape is bounded by the schema; content (magic bytes, per-slot
// dimensions, size, and logo alpha channel) is inspected here — never
// trusted from the client.
function assertSlotContent(data: UpdateBrandingInput) {
  for (const key of ['logoLight', 'logoDark', 'favicon'] as const) {
    const dataUrl = data[key];
    if (dataUrl === undefined || dataUrl === null) continue;
    const bytes = decodeDataUrl(dataUrl);
    const result = bytes
      ? validateBrandingImage(SLOT_BY_KEY[key], bytes, 'image/png')
      : { ok: false as const, reason: 'malformed' as const };
    if (!result.ok) throw new Error(`Invalid branding image for ${key}: ${result.reason}`);
  }
}

export const updateBrandingSettingsFn = createServerFn({ method: 'POST' })
  .validator(updateBrandingSchema)
  .handler(async ({ data }): Promise<BrandingSettings> => {
    const session = await requirePermission('settings', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    assertSlotContent(data);
    const { updateCompanyBranding } = await import('@/lib/db/branding');
    const updated = await updateCompanyBranding(session.user.id, {
      ...(data.logoLight !== undefined ? { logoLight: data.logoLight } : {}),
      ...(data.logoDark !== undefined ? { logoDark: data.logoDark } : {}),
      ...(data.favicon !== undefined ? { favicon: data.favicon } : {}),
      ...(data.profile
        ? {
            profile: {
              name: data.profile.name,
              address: data.profile.address || null,
              email: data.profile.email || null,
              phone: data.profile.phone || null
            }
          }
        : {})
    });
    return toSettings(updated);
  });

// Public branding for the login page and app shells: unauthenticated by
// design and deliberately limited to non-sensitive identity fields (logo
// variants + company name). The name goes through the agreed Company
// Profile fallback chain (DB → env → 'Kolonios').
export const getPublicBrandingFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getCompanyBranding } = await import('@/lib/db/branding');
  const branding = await getCompanyBranding();
  return {
    logoLight: branding.logoLight,
    logoDark: branding.logoDark,
    name: resolveCompanyProfile(branding.profile).name
  };
});

export type { UpdateBrandingInput };
