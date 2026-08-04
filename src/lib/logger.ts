import pino from 'pino';
import { isDev } from './env';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? { target: 'pino-pretty' } : undefined
});
