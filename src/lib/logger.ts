import pino from 'pino';
import { isDev } from './env';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      '*secret*',
      'storage_secret_key',
      'storage_access_key',
      'storage_access_key_id',
      'accessKeyId',
      'secretAccessKey',
      '*.accessKeyId',
      '*.secretAccessKey',
      'Authorization',
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev ? { target: 'pino-pretty' } : undefined
});
