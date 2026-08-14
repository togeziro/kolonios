import type { StorageConfig, StorageProvider } from './types';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

export const STORAGE_PROVIDER_PRESETS: Record<
  StorageProvider,
  { defaultEndpoint: string; defaultRegion: string; forcePathStyle: boolean }
> = {
  idrive_e2: {
    defaultEndpoint: '',
    defaultRegion: 'us-east-1',
    forcePathStyle: false
  },
  aws_s3: {
    defaultEndpoint: '',
    defaultRegion: 'us-east-1',
    forcePathStyle: false
  },
  minio: {
    defaultEndpoint: 'http://localhost:9000',
    defaultRegion: 'us-east-1',
    forcePathStyle: true
  },
  cloudflare_r2: {
    defaultEndpoint: '',
    defaultRegion: 'auto',
    forcePathStyle: true
  },
  custom: {
    defaultEndpoint: '',
    defaultRegion: 'us-east-1',
    forcePathStyle: true
  }
};

export function deriveStorageConfig(
  settings: CompanySetting | null | undefined
): StorageConfig | null {
  if (!settings?.storage_bucket || !settings.storage_access_key || !settings.storage_secret_key) {
    return null;
  }
  const provider: StorageProvider = STORAGE_PROVIDER_PRESETS[
    settings.storage_provider as StorageProvider
  ]
    ? (settings.storage_provider as StorageProvider)
    : 'custom';
  return {
    provider,
    endpoint: settings.storage_endpoint ?? '',
    region: settings.storage_region ?? STORAGE_PROVIDER_PRESETS[provider].defaultRegion,
    bucket: settings.storage_bucket,
    accessKeyId: settings.storage_access_key,
    secretAccessKey: settings.storage_secret_key,
    forcePathStyle:
      settings.storage_force_path_style ?? STORAGE_PROVIDER_PRESETS[provider].forcePathStyle
  };
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '••••';
  return `••••${secret.slice(-4)}`;
}
