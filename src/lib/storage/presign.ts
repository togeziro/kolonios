import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';
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

// Best-effort cleanup for uploads whose business submit failed afterwards
// (e.g. a selfie uploaded before OUTSIDE_RADIUS was returned). Never throws:
// a failed cleanup must not mask the original business error, so failures are
// logged for ops instead. Safe on unconfigured storage (no-op) and idempotent
// server-side (S3 returns success even when the key does not exist).
export async function deleteStorageObject(key: string): Promise<boolean> {
  try {
    const { getCompanySettings } = await import('@/lib/db/masterdata');
    const { deriveStorageConfig, readyConfig } = await import('./config');
    const derived = deriveStorageConfig((await getCompanySettings())?.settings);
    if (!derived) {
      logger.warn({ key }, 'storage.delete-skipped-unconfigured');
      return false;
    }
    const config = await readyConfig(derived);
    const client = buildStorageClient(config);
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    return true;
  } catch (e) {
    logger.warn({ err: e, key }, 'storage.delete-failed');
    return false;
  }
}

export async function testConnection(
  config: StorageConfig
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  try {
    const client = buildStorageClient(config);
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { ok: true };
  } catch (e) {
    const status =
      e instanceof Error
        ? (e as unknown as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    const name = e instanceof Error ? e.name : 'UnknownError';
    const detail = e instanceof Error ? e.message : 'Unknown storage error';
    const code = errorCode(name, status, detail);
    logger.error(
      { err: e, provider: config.provider, bucket: config.bucket, code },
      'storage.test-connection-failed'
    );
    return { ok: false, error: friendlyError(code), code };
  }
}

function errorCode(name: string, status: number | undefined, detail: string): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  const lower = `${name} ${detail}`.toLowerCase();
  if (
    lower.includes('invalidaccesskeyid') ||
    lower.includes('invalidaccess') ||
    lower.includes('access denied') ||
    lower.includes('signaturedoesnotmatch') ||
    lower.includes('signature')
  ) {
    return 'INVALID_CREDENTIALS';
  }
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('socket') ||
    lower.includes('fetch failed')
  ) {
    return 'NETWORK_ERROR';
  }
  if (lower.includes('no such bucket') || lower.includes('bucket not found')) {
    return 'NOT_FOUND';
  }
  return 'CONNECTION_FAILED';
}

function friendlyError(code: string): string {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'INVALID_CREDENTIALS':
      return 'Invalid access key or secret.';
    case 'FORBIDDEN':
      return 'Access key does not have permission to access the bucket.';
    case 'NOT_FOUND':
      return 'Bucket not found or not accessible.';
    case 'NETWORK_ERROR':
      return 'Could not reach the storage endpoint.';
    default:
      return 'Storage connection failed.';
  }
}
