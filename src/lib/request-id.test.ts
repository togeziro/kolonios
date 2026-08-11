import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.hoisted(() => new Map<string, string>());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => ({ get: (name: string) => mockHeaders.get(name) ?? null }),
  getResponseHeaders: () => ({ get: (name: string) => mockHeaders.get(name) }),
  setResponseHeader: (name: string, value: string) => {
    mockHeaders.set(name, value);
  }
}));

import { getRequestId, withRequestContext } from './request-id.server';

describe('withRequestContext', () => {
  afterEach(() => mockHeaders.clear());

  it('generates a request id when none is supplied', async () => {
    let seen: string | undefined;
    await withRequestContext(async () => {
      seen = getRequestId();
    });
    expect(seen).toBeTruthy();
    expect(mockHeaders.get('x-request-id')).toBe(seen);
  });

  it('echoes an incoming x-request-id header', async () => {
    mockHeaders.set('x-request-id', 'incoming-id-1');
    let seen: string | undefined;
    await withRequestContext(async () => {
      seen = getRequestId();
    });
    expect(seen).toBe('incoming-id-1');
    expect(mockHeaders.get('x-request-id')).toBe('incoming-id-1');
  });

  it('returns undefined outside a request scope', () => {
    expect(getRequestId()).toBeUndefined();
  });
});
