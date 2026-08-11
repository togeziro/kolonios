import { createServerOnlyFn } from '@tanstack/react-start';
import { logger } from './logger';
import { captureError } from './sentry';
import { getRequestId } from './request-id.server';

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string = 'DOMAIN_ERROR'
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const mapDbError: (error: unknown, context: string) => never = createServerOnlyFn(
  (error, context) => {
    if (error instanceof DomainError) throw error;
    const requestId = getRequestId();
    logger.error({ context, requestId, err: error }, `[db:${context}]`);
    captureError(error, { context, requestId: requestId ?? '' });
    throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
  }
);
