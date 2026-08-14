export type StorageProvider = 'idrive_e2' | 'aws_s3' | 'minio' | 'cloudflare_r2' | 'custom';

export interface StorageConfig {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}
