import {
  getRequestHeaders,
  getResponseHeaders,
  setResponseHeader
} from '@tanstack/react-start/server';

export function getRequestId(): string | undefined {
  try {
    return getResponseHeaders().get('x-request-id') ?? undefined;
  } catch {
    // Not running inside a request (tests, seed scripts).
    return undefined;
  }
}

export async function withRequestContext<T>(handler: () => Promise<T>): Promise<T> {
  let incoming: string | null = null;
  try {
    incoming = getRequestHeaders().get('x-request-id');
  } catch {
    // Not running inside a request — generate a fresh id.
  }
  try {
    setResponseHeader('x-request-id', incoming || globalThis.crypto.randomUUID());
  } catch {
    // No response object available; the id is still tracked for the handler.
  }
  return handler();
}
