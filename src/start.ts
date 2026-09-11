import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { assertProductionEnv } from './lib/env';
import { initSentry } from './lib/sentry';
import { requestIdMiddleware } from './lib/server-middleware';

// Close the Postgres pool on shutdown so restarts don't leave connections
// hanging until the server's own termination timeout.
function closeDatabaseOnShutdown() {
  void import('./lib/db').then(({ client }) => client?.end({ timeout: 5 })).catch(() => undefined);
}

if (typeof window === 'undefined') {
  // Fail fast on missing production secrets before the server accepts traffic.
  assertProductionEnv();
  process.once('SIGTERM', closeDatabaseOnShutdown);
  process.once('SIGINT', closeDatabaseOnShutdown);
}

export const startInstance = createStart(() => {
  initSentry();
  return {
    requestMiddleware: [
      createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
      requestIdMiddleware
    ]
  };
});
