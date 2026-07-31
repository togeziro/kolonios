import { afterEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { getQueryClient, setQueryClient } from './query-client';

describe('getQueryClient', () => {
  it('returns a singleton QueryClient', () => {
    expect(getQueryClient()).toBeInstanceOf(QueryClient);
    expect(getQueryClient()).toBe(getQueryClient());
  });
});

describe('setQueryClient', () => {
  const original = getQueryClient();

  afterEach(() => {
    setQueryClient(original);
  });

  it('replaces the singleton', () => {
    const replacement = new QueryClient();
    setQueryClient(replacement);
    expect(getQueryClient()).toBe(replacement);
  });
});
