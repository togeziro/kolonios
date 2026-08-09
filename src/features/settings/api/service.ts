import { createServerFn } from '@tanstack/react-start';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/lib/locale/types';
import type { CompanySetting } from '@/lib/db/schema/masterdata';
import { updateAppLocaleSchema } from './validation';

export function resolveAppLocale(settings: CompanySetting | null | undefined): AppLocale {
  if (settings && isAppLocale(settings.locale)) return settings.locale;
  return DEFAULT_LOCALE;
}

export const getAppLocaleFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireSession();
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  const result = await getCompanySettings();
  if (!result?.success) return { locale: DEFAULT_LOCALE };
  return { locale: resolveAppLocale(result.settings) };
});

export const updateAppLocaleFn = createServerFn({ method: 'POST' })
  .validator(updateAppLocaleSchema)
  .handler(async ({ data }) => {
    // Precedent: company_settings writes today are guarded by the holiday
    // module (updateHolidayApiSettingsFn) — keep the same guard.
    const session = await requirePermission('holiday', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateCompanySettings } = await import('@/lib/db/masterdata');
    await updateCompanySettings({ locale: data.locale });
    return { locale: data.locale };
  });
