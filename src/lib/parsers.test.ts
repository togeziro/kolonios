import { describe, expect, it } from 'vitest';
import type { ExtendedColumnSort } from '@/types/data-table';
import { parseSortingState, serializeSortingState } from './parsers';

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
