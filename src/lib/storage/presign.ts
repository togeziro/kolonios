import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageConfig } from './types';

const DEFAULT_EXPIRES_IN = 900;

export function buildStorageClient(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    endpoint: config.endpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export async function createPresignedPutUrl(
  client: S3Client,
  params: { bucket: string; key: string; contentType: string }
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType
  });
  return getSignedUrl(client, command, {
    expiresIn: DEFAULT_EXPIRES_IN,
    signableHeaders: new Set(['content-type'])
  });
}

export async function createPresignedGetUrl(
  client: S3Client,
  params: { bucket: string; key: string; expiresIn?: number }
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: params.bucket, Key: params.key });
  return getSignedUrl(client, command, { expiresIn: params.expiresIn ?? DEFAULT_EXPIRES_IN });
}

export async function testConnection(
  config: StorageConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = buildStorageClient(config);
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown storage error' };
  }
}
