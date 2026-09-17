import { z } from 'zod';

const storageProviderSchema = z.enum(['idrive_e2', 'aws_s3', 'minio', 'cloudflare_r2', 'custom']);

export const storageSettingsSchema = z.object({
  provider: storageProviderSchema,
  endpoint: z.string().trim().max(500).default(''),
  region: z.string().trim().max(100).default('us-east-1'),
  bucket: z.string().trim().min(1).max(100),
  // Blank access key = "keep the stored access key" (round-trip rule,
  // mirrors secretAccessKey). Shadowed by masking the returned value.
  accessKeyId: z.string().trim().max(200).default(''),
  // Blank secret = "keep the stored secret" (secret-key round-trip rule).
  secretAccessKey: z.string().trim().max(200).default(''),
  forcePathStyle: z.boolean()
});

export const testStorageConnectionSchema = storageSettingsSchema;

import { getUploadUrlSchema } from '@/lib/storage/upload-fns';

export { getUploadUrlSchema };
