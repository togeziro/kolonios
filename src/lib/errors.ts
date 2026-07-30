import { logger } from './logger';

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
  logger.error({ context, err: error }, `[db:${context}]`);
  throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
}
