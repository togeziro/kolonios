import { http, HttpResponse } from 'msw';

// Shared demo handlers for UI-integration tests (RTL + MSW).
// These never hit the network: `msw/node` intercepts `fetch` at the
// network layer so components exercise the real HTTP path.
// Override per-test with `server.use(...)`; `server.resetHandlers()`
// in the test file restores these defaults.
export const handlers = [
  http.get('/api/demo-products', () => {
    return HttpResponse.json([
      { id: 1, name: 'Mechanical Keyboard', price: 149.99, inStock: true },
      { id: 2, name: 'Wireless Mouse', price: 59.99, inStock: false }
    ]);
  })
];
