import { createStart } from '@tanstack/react-start';
import { initSentry } from './lib/sentry';

export const startInstance = createStart(() => {
  initSentry();
  return {};
});
