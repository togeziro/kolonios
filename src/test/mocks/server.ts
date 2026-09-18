import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Shared MSW node server for UI-integration tests.
// Import per test file and manage lifecycle there:
//
//   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
//   afterEach(() => server.resetHandlers())
//   afterAll(() => server.close())
//
// `onUnhandledRequest: 'error'` fails fast on unmocked endpoints.
export const server = setupServer(...handlers);
