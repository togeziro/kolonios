import { createMiddleware } from '@tanstack/react-start';

export const requestIdMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  if (handlerType !== 'serverFn') return next();

  let incoming: string | null = null;
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    incoming = getRequestHeaders().get('x-request-id');
  } catch {
    // Not running inside a request — generate a fresh id below.
  }

  const requestId = incoming ?? globalThis.crypto.randomUUID();

  try {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('x-request-id', requestId);
  } catch {
    // No response object available; the id is still tracked for the handler.
  }

  return next();
});
