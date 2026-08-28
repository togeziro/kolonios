// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Fragment, createElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createRouter } from './router';

function UseProbe() {
  // Triggers the same useQueryClient → "No QueryClient set" throw that
  // blew up /auth/v2/sign-in SSR when the QueryClientProvider wasn't
  // installed around the app tree.
  useQuery({ queryKey: ['router-test'], queryFn: () => 'ok', retry: false });
  return createElement('span', { 'data-testid': 'ok' }, 'ok');
}

describe('createRouter SSR query integration', () => {
  it('installs a Wrap component around the app tree', () => {
    const router = createRouter();
    expect(typeof router.options.Wrap).toBe('function');
    // When wrapQueryClient:false is passed, the integration leaves
    // router.options.Wrap untouched (i.e. unset or Fragment). Guard against
    // that regressing — it caused /auth/v2/sign-in to return HTTP 500
    // because LocaleProvider's useQuery had no QueryClientProvider above it.
    expect(router.options.Wrap).not.toBe(Fragment);
  });

  it('Wrap renders a useQuery child without throwing "No QueryClient set"', () => {
    const router = createRouter();
    const Wrap = router.options.Wrap;
    expect(typeof Wrap).toBe('function');
    // If the integration forgot to install QueryClientProvider, this throws
    // synchronously during SSR with "No QueryClient set, use
    // QueryClientProvider to set one".
    expect(() => renderToString(createElement(Wrap!, null, createElement(UseProbe)))).not.toThrow();
  });
});
