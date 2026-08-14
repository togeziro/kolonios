import { describe, expect, it } from 'vitest';
import { storageSettingsSchema, getUploadUrlSchema } from './validation';

describe('storage validation', () => {
  it('accepts a full settings payload', () => {
    const parsed = storageSettingsSchema.parse({
      provider: 'idrive_e2',
      endpoint: 'https://us-east-1.idrivee2.com',
      region: 'us-east-1',
      bucket: 'koloni-dev',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      forcePathStyle: false
    });
    expect(parsed.bucket).toBe('koloni-dev');
  });

  it('rejects unknown providers', () => {
    expect(() =>
      storageSettingsSchema.parse({
        provider: 'google_drive',
        endpoint: '',
        region: '',
        bucket: 'b',
        accessKeyId: 'a',
        secretAccessKey: 's',
        forcePathStyle: false
      })
    ).toThrow();
  });

  it('rejects blank bucket or keys', () => {
    expect(() =>
      storageSettingsSchema.parse({
        provider: 'idrive_e2',
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        accessKeyId: 'a',
        secretAccessKey: 's',
        forcePathStyle: false
      })
    ).toThrow();
  });

  it('allows a blank secretAccessKey (means keep stored secret)', () => {
    const parsed = storageSettingsSchema.parse({
      provider: 'idrive_e2',
      endpoint: '',
      region: 'us-east-1',
      bucket: 'koloni-dev',
      accessKeyId: 'a',
      secretAccessKey: '',
      forcePathStyle: false
    });
    expect(parsed.secretAccessKey).toBe('');
  });

  it('restricts upload folder to the allowlist', () => {
    expect(
      getUploadUrlSchema.parse({ folder: 'attendance', contentType: 'image/jpeg' }).folder
    ).toBe('attendance');
    expect(() => getUploadUrlSchema.parse({ folder: 'etc', contentType: 'image/jpeg' })).toThrow();
  });
});
