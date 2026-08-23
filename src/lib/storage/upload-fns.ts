import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { deriveStorageConfig, readyConfig } from './config';

export const uploadFolderSchema = z.enum(['attendance', 'customers', 'tickets', 'checklists']);

export const getUploadUrlSchema = z.object({
  folder: uploadFolderSchema,
  contentType: z.string().trim().min(1).max(100),
  ownerId: z.string().trim().min(1).max(100).optional()
});

export const getObjectUrlSchema = z.object({
  key: z.string().trim().min(1).max(500)
});

const FOLDER_PERMISSION = {
  attendance: ['attendance', 'view'],
  customers: ['customers', 'add'],
  tickets: ['tickets', 'view'],
  checklists: ['checklist', 'edit']
} as const;

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
    const { buildStorageClient, createPresignedPutUrl } = await import('./presign');
    const { attendanceSelfieKey, customerIdCardKey, ticketPhotoKey, checklistPhotoKey } =
      await import('./keys');
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

    const { buildStorageClient, createPresignedGetUrl } = await import('./presign');
    const url = await createPresignedGetUrl(buildStorageClient(config), {
      bucket: config.bucket,
      key: data.key
    });
    return { url };
  });

export type UploadFolder = z.infer<typeof uploadFolderSchema>;
