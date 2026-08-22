import { createServerFn } from '@tanstack/react-start';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { DomainError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import { maskSecret, deriveStorageConfig } from '@/lib/storage/config';
import type { StorageConfig } from '@/lib/storage/types';
import {
  storageSettingsSchema,
  testStorageConnectionSchema,
  getUploadUrlSchema,
  getObjectUrlSchema
} from './validation';

const FOLDER_PERMISSION = {
  attendance: ['attendance', 'view'],
  customers: ['customers', 'add'],
  tickets: ['tickets', 'view'],
  checklists: ['checklist', 'edit']
} as const;

// Masked places are shown in the UI as hints; submitting that text means
// "keep the stored value" was misunderstood and must never overwrite a real
// credential with the mask glyph itself.
function assertNotMaskedPlaceholder(value: string, label: string): void {
  if (value.includes('•')) {
    throw new DomainError(
      `${label} looks like a masked placeholder. Leave it blank to keep the stored value.`,
      'STORAGE_MASKED_VALUE'
    );
  }
}

// Round-trip rule for access key AND secret: blank means keep the stored
// value; a non-blank value replaces it.
function resolveRoundTrip(submitted: string, stored: string | null | undefined): string {
  return submitted.trim().length > 0 ? submitted : (stored ?? '');
}

function applyEnvOverride(config: StorageConfig): StorageConfig {
  // Deployment escape hatch for idrive_e2: when both env vars are set they
  // win over the stored credentials (useful for managed deployments that keep
  // credentials in the environment, not the DB).
  if (config.provider !== 'idrive_e2') return config;
  const envAccessKey = getEnv('IDRIVE_E2_ACCESS_KEY_ID');
  const envSecret = getEnv('IDRIVE_E2_SECRET_KEY');
  if (!envAccessKey || !envSecret) return config;
  return { ...config, accessKeyId: envAccessKey, secretAccessKey: envSecret };
}

export const getStorageSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('storage', 'view');
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  const result = await getCompanySettings();
  if (!result?.success) return { configured: false };
  const config = deriveStorageConfig(result.settings);
  if (!config) return { configured: false };
  // Never return raw credentials. The secret is decrypted only to compute a
  // masked hint; the access key is masked the same way so neither round-trips
  // back to the client in plaintext.
  const { decryptSecret } = await import('@/lib/storage/secret-crypto');
  return {
    configured: true,
    settings: {
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      accessKeyIdMasked: maskSecret(config.accessKeyId),
      secretKeyMasked: maskSecret(decryptSecret(config.secretAccessKey)),
      forcePathStyle: config.forcePathStyle
    }
  };
});

export const updateStorageSettingsFn = createServerFn({ method: 'POST' })
  .validator(storageSettingsSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('storage', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { getCompanySettings, updateCompanySettings } = await import('@/lib/db/masterdata');
    const { encryptSecret, isEncryptedSecret } = await import('@/lib/storage/secret-crypto');
    const { withAudit } = await import('@/lib/audit');
    // Round-trip rule: a blank value means "keep the stored value". A masked
    // placeholder pasted back into the field is rejected, never persisted.
    assertNotMaskedPlaceholder(data.secretAccessKey, 'Secret key');
    assertNotMaskedPlaceholder(data.accessKeyId, 'Access key');
    const existing = await getCompanySettings();
    const accessKeyId = resolveRoundTrip(data.accessKeyId, existing?.settings?.storage_access_key);
    // Encrypt at rest. Fresh values are always encrypted; a stored value
    // (blank submitted) is kept as-is, including legacy plaintext rows.
    const secret =
      data.secretAccessKey.trim().length > 0
        ? isEncryptedSecret(data.secretAccessKey)
          ? data.secretAccessKey
          : encryptSecret(data.secretAccessKey)
        : (existing?.settings?.storage_secret_key ?? '');
    await withAudit(
      session.user.id,
      {
        action: 'storage.settings.update',
        entityType: 'company_settings',
        before: existing?.success
          ? {
              provider: existing.settings?.storage_provider,
              bucket: existing.settings?.storage_bucket,
              accessKeyId: maskSecret(existing.settings?.storage_access_key ?? ''),
              secretPresent: Boolean(existing.settings?.storage_secret_key)
            }
          : undefined,
        after: {
          provider: data.provider,
          bucket: data.bucket,
          accessKeyId: maskSecret(accessKeyId),
          secretPresent: Boolean(secret)
        }
      },
      async () => {
        await updateCompanySettings({
          storage_provider: data.provider,
          storage_endpoint: data.endpoint || null,
          storage_region: data.region || null,
          storage_bucket: data.bucket,
          storage_access_key: accessKeyId,
          storage_secret_key: secret,
          storage_force_path_style: data.forcePathStyle
        });
      }
    );
    return { success: true };
  });

export const testStorageConnectionFn = createServerFn({ method: 'POST' })
  .validator(testStorageConnectionSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('storage', 'edit');
    await checkRateLimit(`storage-test:${session.user.id}`);
    const { testConnection } = await import('@/lib/storage/presign');
    assertNotMaskedPlaceholder(data.secretAccessKey, 'Secret key');
    assertNotMaskedPlaceholder(data.accessKeyId, 'Access key');
    // Round-trip rule (mirrors updateStorageSettingsFn): blank means "keep the
    // stored credentials" — testing the config about to be saved. A stored
    // secret is encrypted at rest, so decrypt before handing it to the S3
    // client; freshly typed values pass through unchanged.
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const existing = await getCompanySettings();
    const { decryptSecret } = await import('@/lib/storage/secret-crypto');
    const accessKeyId = resolveRoundTrip(data.accessKeyId, existing?.settings?.storage_access_key);
    const storedSecret = (existing?.settings?.storage_secret_key ?? '').trim();
    const secretAccessKey =
      data.secretAccessKey.trim().length > 0
        ? data.secretAccessKey
        : storedSecret
          ? decryptSecret(storedSecret)
          : '';
    const config: StorageConfig = {
      provider: data.provider,
      endpoint: data.endpoint,
      region: data.region,
      bucket: data.bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: data.forcePathStyle
    };
    const result = await testConnection(config);
    const { insertAuditRow } = await import('@/lib/db/audit');
    await insertAuditRow({
      actorUserId: session.user.id,
      action: 'storage.test',
      entityType: 'storage',
      after: { provider: data.provider, bucket: data.bucket, ok: result.ok }
    });
    return result;
  });

export const getUploadUrlFn = createServerFn({ method: 'POST' })
  .validator(getUploadUrlSchema)
  .handler(async ({ data }) => {
    const [module, action] = FOLDER_PERMISSION[data.folder];
    const session = await requirePermission(module, action);
    await checkRateLimit(`write:${session.user.id}`);
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const result = await getCompanySettings();
    const derived = deriveStorageConfig(result?.settings);
    if (!derived) throw new Error('Storage is not configured');
    const config = await readyConfig(derived);
    const { buildStorageClient, createPresignedPutUrl } = await import('@/lib/storage/presign');
    const { attendanceSelfieKey, customerIdCardKey, ticketPhotoKey, checklistPhotoKey } =
      await import('@/lib/storage/keys');
    const timestamp = Date.now();
    let key: string;
    if (data.folder === 'attendance') {
      key = attendanceSelfieKey(session.user.id, timestamp);
    } else if (data.folder === 'customers') {
      // ownerId is the client-generated customer id (created in the form
      // before the row exists) — never the session user's id.
      if (!data.ownerId) throw new Error('ownerId is required for customer uploads');
      key = customerIdCardKey(data.ownerId);
    } else if (data.folder === 'checklists') {
      const itemId = Number(data.ownerId) || timestamp;
      key = checklistPhotoKey(session.user.id, itemId, timestamp);
    } else {
      // tickets: photoId unknown until the ticket photo row exists; the
      // ticket feature supplies ownerId when wiring its upload UI.
      const photoId = Number(data.ownerId) || timestamp;
      key = ticketPhotoKey(0, photoId);
    }
    const url = await createPresignedPutUrl(buildStorageClient(config), {
      bucket: config.bucket,
      key,
      contentType: data.contentType
    });
    return { url, key };
  });

export const getObjectUrlFn = createServerFn({ method: 'POST' })
  .validator(getObjectUrlSchema)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const derived = deriveStorageConfig((await getCompanySettings())?.settings);
    if (!derived) throw new Error('Storage is not configured');
    const config = await readyConfig(derived);

    // IDOR guard: parse the folder prefix, enforce the same folder→permission
    // map as getUploadUrlFn, then the ownership check (attendance keys are
    // owner-scoped unless the caller has attendance.edit).
    const { parseKeyFolder, canViewKey } = await import('./access');
    const folder = parseKeyFolder(data.key);
    const folderPermission = folder ? FOLDER_PERMISSION[folder] : undefined;
    if (!folder || !folderPermission) throw new Error('Invalid object key');
    const [folderModule, folderAction] = folderPermission;
    await requirePermission(folderModule, folderAction);
    let isAdmin = false;
    let canReviewChecklists = false;
    if (folder === 'attendance') {
      try {
        await requirePermission('attendance', 'edit');
        isAdmin = true;
      } catch {
        isAdmin = false;
      }
    }
    if (folder === 'checklists') {
      try {
        await requirePermission('checklist', 'approve');
        canReviewChecklists = true;
      } catch {
        canReviewChecklists = false;
      }
    }
    if (!canViewKey(data.key, session.user.id, isAdmin, canReviewChecklists)) {
      throw new Error('Not allowed to view this object');
    }

    const { buildStorageClient, createPresignedGetUrl } = await import('@/lib/storage/presign');
    const url = await createPresignedGetUrl(buildStorageClient(config), {
      bucket: config.bucket,
      key: data.key
    });
    return { url };
  });

// Resolve the credential the S3 client actually talks with: decrypt the
// stored secret (encrypted at rest) and apply the idrive_e2 env override.
async function readyConfig(config: StorageConfig): Promise<StorageConfig> {
  const { decryptSecret } = await import('@/lib/storage/secret-crypto');
  const withSecret = { ...config, secretAccessKey: decryptSecret(config.secretAccessKey) };
  return applyEnvOverride(withSecret);
}
