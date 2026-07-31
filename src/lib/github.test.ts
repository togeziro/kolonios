import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGitHubRepo, formatCount } from './github';

describe('fetchGitHubRepo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the repo when the response is valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ full_name: 'tanstack/tanstack', stargazers_count: 5000 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    );
    await expect(fetchGitHubRepo('tanstack', 'tanstack')).resolves.toEqual({
      fullName: 'tanstack/tanstack',
      stars: 5000
    });
  });

  it('returns null on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not Found', { status: 404 }))
    );
    await expect(fetchGitHubRepo('x', 'y')).resolves.toBeNull();
  });

  it('returns null when the payload shape is wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ foo: 1 }), { status: 200 }))
    );
    await expect(fetchGitHubRepo('x', 'y')).resolves.toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('network down')))
    );
    await expect(fetchGitHubRepo('x', 'y')).resolves.toBeNull();
  });
});

describe('formatCount', () => {
  it('formats millions', () => {
    expect(formatCount(1_000_000)).toBe('1m');
    expect(formatCount(1_500_000)).toBe('1.5m');
  });

  it('formats thousands', () => {
    expect(formatCount(1_000)).toBe('1k');
    expect(formatCount(2_500)).toBe('2.5k');
  });

  it('formats small numbers with a locale separator', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1200)).toBe('1.2k');
  });
});
