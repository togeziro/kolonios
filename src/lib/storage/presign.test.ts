import { describe, expect, it, vi, beforeEach } from 'vitest';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildStorageClient, createPresignedPutUrl, createPresignedGetUrl } from './presign';
import type { StorageConfig } from './types';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client, command) => `https://presigned/${command.input.Key}`)
}));

const config: StorageConfig = {
  provider: 'idrive_e2',
  endpoint: 'https://us-east-1.idrivee2.com',
  region: 'us-east-1',
  bucket: 'koloni-dev',
  accessKeyId: 'ak',
  secretAccessKey: 'sk',
  forcePathStyle: false
};

describe('storage presign — URL signing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds an S3 client with the stored endpoint and path-style flag', async () => {
    const client = buildStorageClient(config) as S3Client;
    const resolved = await (
      client as unknown as { config: { endpoint: () => Promise<URL> } }
    ).config.endpoint();
    expect(resolved.hostname).toContain('idrivee2');
  });

  it('signs Content-Type into the PUT url via signableHeaders', async () => {
    const client = buildStorageClient(config);
    const url = await createPresignedPutUrl(client, {
      bucket: 'koloni-dev',
      key: 'attendance/u/1.jpg',
      contentType: 'image/jpeg'
    });
    expect(url).toContain('attendance/u/1.jpg');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(PutObjectCommand),
      expect.objectContaining({ signableHeaders: new Set(['content-type']), expiresIn: 900 })
    );
  });

  it('creates presigned GET urls', async () => {
    const client = buildStorageClient(config);
    const url = await createPresignedGetUrl(client, {
      bucket: 'koloni-dev',
      key: 'tickets/1/2.jpg',
      expiresIn: 3600
    });
    expect(url).toContain('tickets/1/2.jpg');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      expect.objectContaining({ expiresIn: 3600 })
    );
  });
});
