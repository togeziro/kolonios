import { createServerFn } from '@tanstack/react-start';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { setWorklogSettingsSchema } from './validation';

export type WorklogSettings = { lenient: boolean };

export function resolveLenient(
  settings: { worklog_location_lenient: boolean | null } | null | undefined
): boolean {
  return settings?.worklog_location_lenient === true;
}

/**
 * Read the applied work-log location policy. Any authenticated user (incl.
 * technicians on the work session page) may read it; only staff edits it.
 */
export const getWorklogSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WorklogSettings> => {
    await requireSession();
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const result = await getCompanySettings();
    if (!result?.success) return { lenient: false };
    return { lenient: resolveLenient(result.settings) };
  }
);

export const setWorklogSettingsFn = createServerFn({ method: 'POST' })
  .validator(setWorklogSettingsSchema)
  .handler(async ({ data }): Promise<WorklogSettings> => {
    const session = await requirePermission('settings', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { getCompanySettings, updateCompanySettings } = await import('@/lib/db/masterdata');
    const { withAudit } = await import('@/lib/audit');
    const existing = await getCompanySettings();
    await withAudit(
      session.user.id,
      {
        action: 'worklog_settings.update',
        entityType: 'company_settings',
        before: { lenient: resolveLenient(existing?.success ? existing.settings : null) },
        after: { lenient: data.lenient }
      },
      async () => {
        await updateCompanySettings({ worklog_location_lenient: data.lenient });
      }
    );
    return { lenient: data.lenient };
  });
