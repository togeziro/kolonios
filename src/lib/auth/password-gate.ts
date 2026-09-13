import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';

/**
 * Forced password-rotation gate (initial/ops accounts).
 *
 * When `user.must_change_password` is true, the dashboard `beforeLoad`
 * redirects every page to PASSWORD_GATE_TARGET until the account owner sets
 * a fresh password via `rotatePasswordFn`, which performs the verified
 * password change AND clears the flag in one server-side step. There is
 * deliberately no standalone clear endpoint: clearing is bound to a
 * server-verified password rotation, so a bare POST cannot drop the flag.
 * The flag is set by `scripts/create-initial-admin.ts`; it is never cleared
 * by another admin or via SQL.
 *
 * Enforcement is UI-shell level (hygiene, not access control): the session
 * itself stays valid, so a flagged user is never bricked — the worst case
 * is being routed back to change-password. Per-module authorization
 * (`requirePermissionRpc`) stays fail-closed underneath and is unaffected.
 */

/** Dashboard path a flagged user is confined to (single source of truth). */
export const PASSWORD_GATE_TARGET = '/dashboard/change-password';

/** Dashboard paths a flagged user may still open. */
const GATE_EXEMPT_PATHS = [PASSWORD_GATE_TARGET] as const;

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Pure seam: is this dashboard path exempt from the rotation gate? */
export function isPasswordGateExempt(pathname: string): boolean {
  return (GATE_EXEMPT_PATHS as readonly string[]).includes(normalizePath(pathname));
}

/** Server-only: reads the caller's rotation flag from the DB. */
export async function getMustChangePassword(userId: string): Promise<boolean> {
  const { db } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  const { user } = await import('@/lib/db/auth-schema');
  const rows = await db
    .select({ flag: user.mustChangePassword })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0]?.flag ?? false;
}

/** Server-only: clears the caller's own rotation flag. */
export async function clearMustChangePassword(userId: string): Promise<void> {
  const { db } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  const { user } = await import('@/lib/db/auth-schema');
  await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId));
}

export const getPasswordGateFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireSession } = await import('./session');
  const session = await requireSession();
  return getMustChangePassword(session.user.id);
});

const rotatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

/**
 * Verified rotation: changes the caller's password through better-auth
 * (current password proof checked server-side, other sessions revoked)
 * and clears the rotation flag only after the change succeeds. Returns a
 * discriminated result instead of throwing so the UI can map wrong-current
 * vs generic failures without parsing error internals.
 */
export const rotatePasswordFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(rotatePasswordSchema))
  .handler(async ({ data }) => {
    const { requireSession } = await import('./session');
    const session = await requireSession();
    const { auth } = await import('./auth.server');
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    try {
      await (auth.api as any).changePassword({
        headers: getRequestHeaders(),
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: true
        }
      });
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      const message = String(e?.message ?? e?.body?.message ?? '');
      if (status === 400 || status === 401 || /invalid|incorrect|wrong/i.test(message)) {
        return { ok: false as const, code: 'WRONG_CURRENT' as const };
      }
      return { ok: false as const, code: 'GENERIC' as const };
    }
    await clearMustChangePassword(session.user.id);
    return { ok: true as const };
  });
