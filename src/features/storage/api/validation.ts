import { z } from 'zod';

export const storageProviderSchema = z.enum([
  'idrive_e2',
  'aws_s3',
  'minio',
  'cloudflare_r2',
  'custom'
]);

export const storageSettingsSchema = z.object({
  provider: storageProviderSchema,
  endpoint: z.string().trim().max(500).default(''),
  region: z.string().trim().max(100).default('us-east-1'),
  bucket: z.string().trim().min(1).max(100),
  accessKeyId: z.string().trim().min(1).max(200),
  // Blank secret = "keep the stored secret" (secret-key round-trip rule).
  secretAccessKey: z.string().trim().max(200).default(''),
  forcePathStyle: z.boolean()
});

export const testStorageConnectionSchema = storageSettingsSchema;

export const uploadFolderSchema = z.enum(['attendance', 'customers', 'tickets']);

export const getUploadUrlSchema = z.object({
  folder: uploadFolderSchema,
  contentType: z.string().trim().min(1).max(100),
  ownerId: z.string().trim().min(1).max(100).optional()
});

export const getObjectUrlSchema = z.object({
  key: z.string().trim().min(1).max(500)
});

export type StorageSettingsInput = z.infer<typeof storageSettingsSchema>;
export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>;
