import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { DomainError } from '@/lib/errors';
import { maskSecret, deriveStorageConfig } from '@/lib/storage/config';
import type { StorageConfig } from '@/lib/storage/types';
import { storageSettingsSchema, testStorageConnectionSchema } from './validation';

export { getUploadUrlFn, getObjectUrlFn } from '@/lib/storage/upload-fns';

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
