import { createServerFn } from '@tanstack/react-start';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { maskSecret, deriveStorageConfig } from '@/lib/storage/config';
import { STORAGE_PROVIDER_PRESETS } from '@/lib/storage/config';
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
  tickets: ['tickets', 'view']
} as const;

export const getStorageSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('storage', 'view');
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  const result = await getCompanySettings();
  if (!result?.success) return { configured: false };
  const config = deriveStorageConfig(result.settings);
  if (!config) return { configured: false };
  return {
    configured: true,
    settings: {
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretKeyMasked: maskSecret(config.secretAccessKey),
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
    // Secret-key round-trip rule: a blank secret on submit means "keep the
    // stored secret". Never persist a blank or masked value over the real key.
    const existing = await getCompanySettings();
    const secret =
      data.secretAccessKey.trim().length > 0
        ? data.secretAccessKey
        : (existing?.settings?.storage_secret_key ?? '');
    await updateCompanySettings({
      storage_provider: data.provider,
      storage_endpoint: data.endpoint || null,
      storage_region: data.region || null,
      storage_bucket: data.bucket,
      storage_access_key: data.accessKeyId,
      storage_secret_key: secret,
      storage_force_path_style: data.forcePathStyle
    });
    return { success: true };
  });

export const testStorageConnectionFn = createServerFn({ method: 'POST' })
  .validator(testStorageConnectionSchema)
  .handler(async ({ data }) => {
    await requirePermission('storage', 'edit');
    const { testConnection } = await import('@/lib/storage/presign');
    // Secret-key round-trip rule: a blank secret means "keep the stored
    // secret" — testing the config about to be saved (same rule as
    // updateStorageSettingsFn).
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const existing = await getCompanySettings();
    const secret =
      data.secretAccessKey.trim().length > 0
        ? data.secretAccessKey
        : (existing?.settings?.storage_secret_key ?? '');
    const config: StorageConfig = {
      provider: data.provider,
      endpoint: data.endpoint,
      region: data.region,
      bucket: data.bucket,
      accessKeyId: data.accessKeyId,
      secretAccessKey: secret,
      forcePathStyle: data.forcePathStyle
    };
    return testConnection(config);
  });

export const getUploadUrlFn = createServerFn({ method: 'POST' })
  .validator(getUploadUrlSchema)
  .handler(async ({ data }) => {
    const [module, action] = FOLDER_PERMISSION[data.folder];
    const session = await requirePermission(module, action);
    await checkRateLimit(`write:${session.user.id}`);
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const result = await getCompanySettings();
    const config = deriveStorageConfig(result?.settings);
    if (!config) throw new Error('Storage is not configured');
    const { buildStorageClient, createPresignedPutUrl } = await import('@/lib/storage/presign');
    const { attendanceSelfieKey, customerIdCardKey, ticketPhotoKey } =
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
    const config = deriveStorageConfig((await getCompanySettings())?.settings);
    if (!config) throw new Error('Storage is not configured');

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
    if (folder === 'attendance') {
      try {
        await requirePermission('attendance', 'edit');
        isAdmin = true;
      } catch {
        isAdmin = false;
      }
    }
    if (!canViewKey(data.key, session.user.id, isAdmin)) {
      throw new Error('Not allowed to view this object');
    }

    const { buildStorageClient, createPresignedGetUrl } = await import('@/lib/storage/presign');
    const url = await createPresignedGetUrl(buildStorageClient(config), {
      bucket: config.bucket,
      key: data.key
    });
    return { url };
  });
