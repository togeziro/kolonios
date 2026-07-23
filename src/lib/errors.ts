export class DomainError extends Error {}

export function mapDbError(error: unknown, context: string): never {
  if (error instanceof DomainError) throw error;
  console.error(`[db:${context}]`, error);
  throw new Error('An internal error occurred. Please try again.');
}
