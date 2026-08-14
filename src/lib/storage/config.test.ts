import { describe, expect, it } from 'vitest';
import { STORAGE_PROVIDER_PRESETS, deriveStorageConfig, maskSecret } from './config';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

describe('storage config', () => {
  it('provides presets for all supported providers', () => {
    expect(Object.keys(STORAGE_PROVIDER_PRESETS).sort()).toEqual([
      'aws_s3',
      'cloudflare_r2',
      'custom',
      'idrive_e2',
      'minio'
    ]);
  });

  it('idrive_e2 uses path-style addressing like minio/r2/custom; aws_s3 is virtual-hosted', () => {
    expect(STORAGE_PROVIDER_PRESETS.idrive_e2.forcePathStyle).toBe(true);
    expect(STORAGE_PROVIDER_PRESETS.aws_s3.forcePathStyle).toBe(false);
    expect(STORAGE_PROVIDER_PRESETS.minio.forcePathStyle).toBe(true);
    expect(STORAGE_PROVIDER_PRESETS.cloudflare_r2.forcePathStyle).toBe(true);
    expect(STORAGE_PROVIDER_PRESETS.custom.forcePathStyle).toBe(true);
  });

  it('derives a config from stored company settings', () => {
    const settings = {
      storage_provider: 'idrive_e2',
      storage_endpoint: 'https://us-east-1.idrivee2.com',
      storage_region: 'us-east-1',
      storage_bucket: 'koloni-dev',
      storage_access_key: 'ak',
      storage_secret_key: 'sk',
      storage_force_path_style: false
    } as unknown as CompanySetting;
    expect(deriveStorageConfig(settings)).toEqual({
      provider: 'idrive_e2',
      endpoint: 'https://us-east-1.idrivee2.com',
      region: 'us-east-1',
      bucket: 'koloni-dev',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      // DB default false is overridden by the idrive_e2 preset (path style)
      forcePathStyle: true
    });
  });

  it('falls back to the preset forcePathStyle when the stored flag is the DB default false and the preset requires true', () => {
    const settings = {
      storage_provider: 'idrive_e2',
      storage_endpoint: 'https://us-east-1.idrivee2.com',
      storage_region: 'us-east-1',
      storage_bucket: 'koloni-dev',
      storage_access_key: 'ak',
      storage_secret_key: 'sk',
      storage_force_path_style: false
    } as unknown as CompanySetting;
    expect(deriveStorageConfig(settings)?.forcePathStyle).toBe(true);
  });

  it('keeps stored false for providers whose preset does not require path style', () => {
    const settings = {
      storage_provider: 'aws_s3',
      storage_endpoint: 'https://s3.amazonaws.com',
      storage_region: 'us-east-1',
      storage_bucket: 'koloni-dev',
      storage_access_key: 'ak',
      storage_secret_key: 'sk',
      storage_force_path_style: false
    } as unknown as CompanySetting;
    expect(deriveStorageConfig(settings)?.forcePathStyle).toBe(false);
  });

  it('uses the preset forcePathStyle when the stored flag is unset', () => {
    const settings = {
      storage_provider: 'idrive_e2',
      storage_bucket: 'koloni-dev',
      storage_access_key: 'ak',
      storage_secret_key: 'sk'
    } as unknown as CompanySetting;
    expect(deriveStorageConfig(settings)?.forcePathStyle).toBe(true);
  });

  it('returns null when storage is not configured (no bucket)', () => {
    expect(deriveStorageConfig(null)).toBeNull();
    const partial = { storage_provider: 'idrive_e2' } as unknown as CompanySetting;
    expect(deriveStorageConfig(partial)).toBeNull();
  });

  it('masks secret keys, keeping the last 4 characters', () => {
    expect(maskSecret('abcdefgh')).toBe('••••efgh');
    expect(maskSecret('abc')).toBe('••••');
    expect(maskSecret('')).toBe('');
  });
});
