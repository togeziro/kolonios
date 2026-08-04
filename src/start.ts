import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { initSentry } from './lib/sentry';
import { requestIdMiddleware } from './lib/server-middleware';

export const startInstance = createStart(() => {
  initSentry();
  return {
    requestMiddleware: [
      createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
      requestIdMiddleware
    ]
  };
});
