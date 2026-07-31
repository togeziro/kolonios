import { describe, expect, it } from 'vitest';
import type { ExtendedColumnFilter, ExtendedColumnSort } from '@/types/data-table';
import {
  buildFilterSearchParams,
  parseFilterValuesFromSearch,
  parseFiltersState,
  parseSortingState,
  serializeFiltersState,
  serializeSortingState
} from './parsers';

describe('parseSortingState', () => {
  it('returns an empty array for undefined input', () => {
    expect(parseSortingState(undefined)).toEqual([]);
  });

  it('returns an empty array for invalid JSON', () => {
    expect(parseSortingState('not json')).toEqual([]);
  });

  it('returns an empty array when the shape is wrong', () => {
    expect(parseSortingState('[{"foo":"bar"}]')).toEqual([]);
  });

  it('parses a valid sorting state', () => {
    const value = JSON.stringify([{ id: 'name', desc: true }]);
    expect(parseSortingState(value)).toEqual([{ id: 'name', desc: true }]);
  });

  it('drops the whole state if any entry id is not allowed', () => {
    const value = JSON.stringify([
      { id: 'name', desc: false },
      { id: 'hacked', desc: true }
    ]);
    expect(parseSortingState(value, ['name', 'price'])).toEqual([]);
  });

  it('accepts a Set of allowed column ids', () => {
    const value = JSON.stringify([{ id: 'price', desc: true }]);
    expect(parseSortingState(value, new Set(['price']))).toEqual([{ id: 'price', desc: true }]);
  });

  it('round-trips through serializeSortingState', () => {
    const state = [
      { id: 'created_at' as const, desc: false }
    ] as unknown as ExtendedColumnSort<unknown>[];
    expect(parseSortingState(serializeSortingState(state))).toEqual([...state]);
  });
});

describe('parseFilterValuesFromSearch', () => {
  const columns = [
    { id: 'status', meta: { options: ['a', 'b'] } },
    { id: 'name' },
    { id: 'category', meta: { options: [] } }
  ];

  it('parses option columns into arrays', () => {
    const result = parseFilterValuesFromSearch({ status: 'a,b', category: 'x' }, columns);
    expect(result.status).toEqual(['a', 'b']);
    expect(result.category).toEqual(['x']);
  });

  it('parses plain columns into strings', () => {
    expect(parseFilterValuesFromSearch({ name: 'jane' }, columns).name).toBe('jane');
  });

  it('sets null for missing or non-string values', () => {
    const result = parseFilterValuesFromSearch({ name: 42 }, columns);
    expect(result.name).toBeNull();
    expect(result.status).toBeNull();
  });
});

describe('buildFilterSearchParams', () => {
  it('resets the page and merges values', () => {
    const updater = buildFilterSearchParams({ name: 'jane', status: null });
    const next = updater({ page: 3, foo: 'bar' });
    expect(next).toEqual({ page: 1, foo: 'bar', name: 'jane' });
    expect(next).not.toHaveProperty('status');
  });

  it('joins arrays with a comma', () => {
    const next = buildFilterSearchParams({ status: ['a', 'b'] })({});
    expect(next.status).toBe('a,b');
  });
});

describe('parseFiltersState', () => {
  const validFilter = {
    id: 'name',
    value: 'jane',
    variant: 'text',
    operator: 'iLike',
    filterId: 'f1'
  } as unknown as ExtendedColumnFilter<unknown>;

  it('returns an empty array for undefined input', () => {
    expect(parseFiltersState(undefined)).toEqual([]);
  });

  it('returns an empty array for invalid JSON', () => {
    expect(parseFiltersState('nope')).toEqual([]);
  });

  it('returns an empty array when the shape is wrong', () => {
    expect(parseFiltersState(JSON.stringify([{ id: 'name' }]))).toEqual([]);
  });

  it('parses a valid filter state', () => {
    expect(parseFiltersState(JSON.stringify([validFilter]))).toEqual([validFilter]);
  });

  it('drops the whole state if any id is not allowed', () => {
    expect(
      parseFiltersState(JSON.stringify([validFilter, { ...validFilter, id: 'hacked' }]), ['name'])
    ).toEqual([]);
  });

  it('accepts a Set of allowed column ids', () => {
    expect(parseFiltersState(JSON.stringify([validFilter]), new Set(['name']))).toEqual([
      validFilter
    ]);
  });

  it('round-trips through serializeFiltersState', () => {
    expect(parseFiltersState(serializeFiltersState([validFilter]))).toEqual([validFilter]);
  });
});
