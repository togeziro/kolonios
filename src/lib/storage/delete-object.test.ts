// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-s3', () => {
  class FakeClient {
    config: unknown;
    send = sendMock;
    constructor(config: unknown) {
      this.config = config;
    }
  }
  const passthrough = (input: unknown) => ({ input });
  return {
    S3Client: FakeClient,
    DeleteObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    PutObjectCommand: passthrough,
    GetObjectCommand: passthrough,
    HeadBucketCommand: passthrough
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/url')
}));

vi.mock('@/lib/db/masterdata', () => ({
  getCompanySettings: vi.fn()
}));

vi.mock('@/lib/storage/secret-crypto', () => ({
  encryptSecret: (s: string) => `enc:${s}`,
  decryptSecret: (s: string) => s.replace(/^enc:/, '')
}));

import { getCompanySettings } from '@/lib/db/masterdata';
import { deleteStorageObject } from './presign';

const companySettings = {
  storage_provider: 'minio',
  storage_endpoint: 'http://localhost:9000',
  storage_region: 'us-east-1',
  storage_bucket: 'test-bucket',
  storage_access_key: 'key',
  storage_secret_key: 'enc:secret',
  storage_force_path_style: true
};

describe('deleteStorageObject', () => {
  beforeEach(() => {
    vi.mocked(getCompanySettings).mockReset();
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  it('deletes the object and reports success', async () => {
    vi.mocked(getCompanySettings).mockResolvedValue({ settings: companySettings } as never);

    const ok = await deleteStorageObject('attendance/user-1/123.jpg');

    expect(ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'attendance/user-1/123.jpg' });
  });

  it('is a no-op when storage is unconfigured', async () => {
    vi.mocked(getCompanySettings).mockResolvedValue({ settings: null } as never);

    const ok = await deleteStorageObject('attendance/user-1/123.jpg');

    expect(ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('resolves false instead of throwing when the delete fails', async () => {
    vi.mocked(getCompanySettings).mockResolvedValue({ settings: companySettings } as never);
    sendMock.mockRejectedValue(new Error('NoSuchBucket'));

    await expect(deleteStorageObject('attendance/user-1/123.jpg')).resolves.toBe(false);
  });
});
