import { logger } from './logger';
import { getRequestId } from './request-id';
import { captureError } from './sentry';

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string = 'DOMAIN_ERROR'
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function mapDbError(error: unknown, context: string): never {
  if (error instanceof DomainError) throw error;
  const requestId = getRequestId();
  logger.error({ context, requestId, err: error }, `[db:${context}]`);
  captureError(error, { context, requestId: requestId ?? '' });
  throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
}
