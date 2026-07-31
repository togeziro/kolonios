import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api-client';

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends the API prefix and returns the parsed json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
    await expect(apiClient<{ ok: boolean }>('/health')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('/api/v1/health', {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('merges caller options into the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    );
    await apiClient('/ping', { method: 'POST', body: '{}' });
    expect(fetch).toHaveBeenCalledWith('/api/v1/ping', {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: '{}'
    });
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 500 }))
    );
    await expect(apiClient('/boom')).rejects.toThrow('API error: 500');
  });
});
