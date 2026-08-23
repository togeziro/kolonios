import { getEnv } from '@/lib/env';
import type { StorageConfig, StorageProvider } from './types';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

export const STORAGE_PROVIDER_PRESETS: Record<
  StorageProvider,
  { defaultEndpoint: string; defaultRegion: string; forcePathStyle: boolean }
> = {
  idrive_e2: {
    defaultEndpoint: '',
    defaultRegion: 'us-east-1',
    forcePathStyle: true
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
      settings.storage_force_path_style === false &&
      STORAGE_PROVIDER_PRESETS[provider].forcePathStyle === true
        ? STORAGE_PROVIDER_PRESETS[provider].forcePathStyle
        : (settings.storage_force_path_style ?? STORAGE_PROVIDER_PRESETS[provider].forcePathStyle)
  };
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '••••';
  return `••••${secret.slice(-4)}`;
}

export function applyEnvOverride(config: StorageConfig): StorageConfig {
  // Deployment escape hatch for idrive_e2: when both env vars are set they
  // win over the stored credentials (useful for managed deployments that keep
  // credentials in the environment, not the DB).
  if (config.provider !== 'idrive_e2') return config;
  const envAccessKey = getEnv('IDRIVE_E2_ACCESS_KEY_ID');
  const envSecret = getEnv('IDRIVE_E2_SECRET_KEY');
  if (!envAccessKey || !envSecret) return config;
  return { ...config, accessKeyId: envAccessKey, secretAccessKey: envSecret };
}

// Resolve the credential the S3 client actually talks with: decrypt the
// stored secret (encrypted at rest) and apply the idrive_e2 env override.
export async function readyConfig(config: StorageConfig): Promise<StorageConfig> {
  const { decryptSecret } = await import('@/lib/storage/secret-crypto');
  const withSecret = { ...config, secretAccessKey: decryptSecret(config.secretAccessKey) };
  return applyEnvOverride(withSecret);
}
