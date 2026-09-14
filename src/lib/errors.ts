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

// Better Auth client errors are expected business outcomes — e.g. creating a
// user with a duplicate email — not application bugs. They must stay visible
// (warn log + original message to the caller) but out of Sentry. Matched by
// the machine-readable body.code; anything unlisted keeps the old path.
const EXPECTED_AUTH_ERROR_CODES = new Set(['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL']);

function getAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== 'object' || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export const mapDbError: (error: unknown, context: string) => never = createServerOnlyFn(
  (error, context) => {
    if (error instanceof DomainError) throw error;
    const requestId = getRequestId();
    const expectedCode = getAuthErrorCode(error);
    if (expectedCode && EXPECTED_AUTH_ERROR_CODES.has(expectedCode)) {
      logger.warn({ context, requestId, code: expectedCode }, `[db:${context}] ${expectedCode}`);
      throw new DomainError(getErrorMessage(error) ?? 'Request failed.', expectedCode);
    }
    logger.error({ context, requestId, err: error }, `[db:${context}]`);
    captureError(error, { context, requestId: requestId ?? '' });
    throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
  }
);

// duck-typed: TanStack Start serializes DomainError as {name,code,message}
export function getErrorMessage(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (error instanceof Error) return error.message || undefined;
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return undefined;
}
