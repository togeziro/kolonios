import { createServerFn } from '@tanstack/react-start';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit, getAppliedRateLimits, invalidateRateLimitCache } from '@/lib/rate-limit';
import { rateLimitSchema } from './validation';
import { RATE_LIMIT_DEFAULTS } from '@/lib/constants';

export type RateLimitSettings = {
  /** Effective values currently applied by the runtime limiter. */
  applied: { max: number; windowMs: number };
  /** DB override, or null when falling back to env/defaults. */
  override: { max: number; windowMs: number } | null;
};

/**
 * Read effective + configured rate-limit values. Anyone signed in may read the
 * applied limits; only staff may edit them (enforced in the update fn).
 */
export const getRateLimitSettingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RateLimitSettings> => {
    await requireSession();
    const applied = await getAppliedRateLimits();
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const result = await getCompanySettings();
    const s = result?.settings;
    const override =
      s?.rate_limit_max && s.rate_limit_window_ms
        ? { max: s.rate_limit_max, windowMs: s.rate_limit_window_ms }
        : null;
    return { applied, override };
  }
);

export const updateRateLimitSettingsFn = createServerFn({ method: 'POST' })
  .validator(rateLimitSchema)
  .handler(async ({ data }): Promise<RateLimitSettings> => {
    const session = await requirePermission('settings', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { getCompanySettings, updateCompanySettings } = await import('@/lib/db/masterdata');
    const { withAudit } = await import('@/lib/audit');
    const existing = await getCompanySettings();
    await withAudit(
      session.user.id,
      {
        action: 'rate_limit_settings.update',
        entityType: 'company_settings',
        before: {
          max: existing?.settings?.rate_limit_max ?? null,
          windowMs: existing?.settings?.rate_limit_window_ms ?? null
        },
        after: { max: data.max, windowMs: data.windowMs }
      },
      async () => {
        await updateCompanySettings({
          rate_limit_max: data.max,
          rate_limit_window_ms: data.windowMs
        });
      }
    );
    invalidateRateLimitCache();
    return {
      applied: { max: data.max, windowMs: data.windowMs },
      override: { max: data.max, windowMs: data.windowMs }
    };
  });

export const resetRateLimitSettingsFn = createServerFn({
  method: 'POST'
}).handler(async (): Promise<RateLimitSettings> => {
  const session = await requirePermission('settings', 'edit');
  await checkRateLimit(`write:${session.user.id}`);
  const { updateCompanySettings } = await import('@/lib/db/masterdata');
  const { withAudit } = await import('@/lib/audit');
  await withAudit(
    session.user.id,
    {
      action: 'rate_limit_settings.reset',
      entityType: 'company_settings',
      before: {},
      after: { reset: true }
    },
    async () => {
      await updateCompanySettings({
        rate_limit_max: null,
        rate_limit_window_ms: null
      });
    }
  );
  invalidateRateLimitCache();
  const defaults = {
    max: parseInt(process.env.RATE_LIMIT_MAX || String(RATE_LIMIT_DEFAULTS.max), 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(RATE_LIMIT_DEFAULTS.windowMs), 10)
  };
  return { applied: defaults, override: null };
});
