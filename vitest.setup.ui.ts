// UI test setup (unit project only).
//
// - Registers jest-dom matchers via the vitest entry point
//   (`toBeInTheDocument`, `toHaveTextContent`, ...).
// - Auto-cleans RTL renders between tests.
// MSW server lifecycle is per-file (import from `@/test/mocks/server`),
// not global, so pure unit tests pay no network-intercept cost.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
