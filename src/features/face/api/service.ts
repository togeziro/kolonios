import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { user } from '@/lib/db/auth-schema';
import { companySettings } from '@/lib/db/schema/masterdata';
import { isFaceDescriptor, type FaceAccuracyLevel } from '@/lib/face/types';
import {
  faceEnrollmentSchema,
  faceVerifySchema,
  faceSettingsSchema,
  type FaceSettingsInput
} from './validation';

export const MIN_ANTI_SPOOF_SCORE = 0.5;
export const MIN_LIVENESS_SCORE = 0.5;

// --- Enrollment (self-service) ---

export const getMyFaceEnrollmentFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('attendance', 'view');
  const [row] = await db
    .select({ faceDescriptor: user.faceDescriptor, faceRegisteredAt: user.faceRegisteredAt })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  const descriptors = row?.faceDescriptor ?? [];
  return {
    enrolled: Array.isArray(descriptors) && descriptors.length > 0,
    count: Array.isArray(descriptors) ? descriptors.length : 0,
    registeredAt: row?.faceRegisteredAt ?? null
  };
});

export const enrollFaceFn = createServerFn({ method: 'POST' })
  .validator(faceEnrollmentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('attendance', 'view');
    await checkRateLimit(`face:${session.user.id}`);
    const descriptors = data.descriptors.filter(isFaceDescriptor);
    if (descriptors.length === 0) {
      throw new Error('Invalid face descriptor');
    }
    const [updated] = await db
      .update(user)
      .set({ faceDescriptor: descriptors, faceRegisteredAt: new Date() })
      .where(eq(user.id, session.user.id))
      .returning({ faceDescriptor: user.faceDescriptor, faceRegisteredAt: user.faceRegisteredAt });
    await withAudit(
      session.user.id,
      {
        action: 'face.enroll',
        entityType: 'user',
        entityId: session.user.id,
        before: null,
        after: { count: descriptors.length }
      },
      async () => undefined
    );
    return {
      success: true,
      count: updated?.faceDescriptor?.length ?? 0,
      registeredAt: updated?.faceRegisteredAt ?? null
    };
  });

export const clearFaceEnrollmentFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await requirePermission('attendance', 'view');
  await checkRateLimit(`face:${session.user.id}`);
  await db
    .update(user)
    .set({ faceDescriptor: null, faceRegisteredAt: null })
    .where(eq(user.id, session.user.id));
  await withAudit(
    session.user.id,
    {
      action: 'face.clear',
      entityType: 'user',
      entityId: session.user.id,
      before: null,
      after: null
    },
    async () => undefined
  );
  return { success: true };
});

// --- Verification (server-side decision) ---

export const verifyFaceFn = createServerFn({ method: 'POST' })
  .validator(faceVerifySchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('attendance', 'view');
    await checkRateLimit(`face:${session.user.id}`);
    const [row] = await db
      .select({ faceDescriptor: user.faceDescriptor })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!row?.faceDescriptor || row.faceDescriptor.length === 0) {
      return { verified: false, reason: 'NOT_ENROLLED' };
    }

    // Anti-spoof / liveness gate — scores are produced client-side by Human,
    // but a low score must fail closed even if the descriptor matches.
    if (data.antiSpoofScore != null && data.antiSpoofScore < MIN_ANTI_SPOOF_SCORE) {
      return { verified: false, reason: 'ANTI_SPOOF_FAIL' };
    }
    if (data.livenessScore != null && data.livenessScore < MIN_LIVENESS_SCORE) {
      return { verified: false, reason: 'LIVENESS_FAIL' };
    }

    const [settings] = await db.select().from(companySettings).limit(1);
    const accuracyLevel: FaceAccuracyLevel =
      (settings?.faceAccuracyLevel as FaceAccuracyLevel) ?? 'medium';

    const { matchFace } = await import('@/lib/face/match');
    const result = matchFace(data.descriptor, row.faceDescriptor, accuracyLevel);
    const verified = result.matched;

    return {
      verified,
      reason: verified ? 'MATCH' : 'NO_MATCH',
      confidence: result.confidence,
      distance: result.distance
    };
  });

// --- Company settings (admin) ---

export const getFaceSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('attendance', 'edit');
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  const result = await getCompanySettings();
  return {
    validationMode: (result?.settings?.faceValidationMode ??
      'background') as FaceSettingsInput['validationMode'],
    accuracyLevel: (result?.settings?.faceAccuracyLevel ?? 'medium') as FaceAccuracyLevel,
    showSeconds: result?.settings?.showSeconds ?? false
  };
});

export const updateFaceSettingsFn = createServerFn({ method: 'POST' })
  .validator(faceSettingsSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('attendance', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateCompanySettings } = await import('@/lib/db/masterdata');
    await updateCompanySettings({
      faceValidationMode: data.validationMode,
      faceAccuracyLevel: data.accuracyLevel,
      showSeconds: data.showSeconds
    });
    await withAudit(
      session.user.id,
      {
        action: 'face.settings.update',
        entityType: 'company_settings',
        entityId: undefined,
        before: null,
        after: data
      },
      async () => undefined
    );
    return { success: true, settings: data };
  });
