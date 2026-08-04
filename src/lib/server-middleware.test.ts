import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.hoisted(() => new Map<string, string>());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => ({ get: (name: string) => mockHeaders.get(name) ?? null }),
  getResponseHeaders: () => ({ get: (name: string) => mockHeaders.get(name) }),
  setResponseHeader: (name: string, value: string) => {
    mockHeaders.set(name, value);
  }
}));

import { requestIdMiddleware } from './server-middleware';

async function runMiddleware(overrides: Record<string, unknown> = {}) {
  const next = vi.fn(async (opts?: { context?: unknown }) => ({ context: opts?.context }));
  const ctx = {
    request: new Request('http://localhost:3000/rpc'),
    pathname: '/rpc',
    context: {},
    handlerType: 'serverFn',
    next,
    ...overrides
  };
  await (
    requestIdMiddleware as unknown as { options: { server?: (c: unknown) => unknown } }
  ).options.server?.(ctx);
  return next;
}

describe('requestIdMiddleware', () => {
  afterEach(() => mockHeaders.clear());

  it('sets x-request-id on the response when none is supplied', async () => {
    await runMiddleware();
    expect(mockHeaders.get('x-request-id')).toBeTruthy();
  });

  it('echoes an incoming x-request-id header', async () => {
    mockHeaders.set('x-request-id', 'incoming-id-1');
    await runMiddleware();
    expect(mockHeaders.get('x-request-id')).toBe('incoming-id-1');
  });

  it('passes through non-serverFn requests without setting the header', async () => {
    await runMiddleware({ handlerType: 'router' });
    expect(mockHeaders.get('x-request-id')).toBeUndefined();
  });
});
