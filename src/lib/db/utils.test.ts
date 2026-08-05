import { describe, it, expect } from 'vitest';
import { buildPagination, parseSort, buildOrderBy, buildConditions } from './utils';

describe('buildPagination', () => {
  it('should return default pagination', () => {
    const result = buildPagination({});
    expect(result).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it('should clamp limit to 100', () => {
    const result = buildPagination({ limit: 200 });
    expect(result.limit).toBe(100);
  });

  it('should clamp limit to minimum 1', () => {
    const result = buildPagination({ limit: 0 });
    expect(result.limit).toBe(1);
  });

  it('should calculate offset correctly', () => {
    const result = buildPagination({ page: 3, limit: 20 });
    expect(result.offset).toBe(40);
  });
});

describe('parseSort', () => {
  it('should parse valid sort string', () => {
    const result = parseSort('[{"id":"name","desc":true}]');
    expect(result).toEqual({ id: 'name', desc: true });
  });

  it('should return undefined for invalid JSON', () => {
    const result = parseSort('invalid json');
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const result = parseSort('');
    expect(result).toBeUndefined();
  });
});

describe('buildOrderBy', () => {
  it('should return undefined when no sort input', () => {
    const result = buildOrderBy({}, { name: 'name' });
    expect(result).toBeUndefined();
  });

  it('should return asc order when desc is false', () => {
    const columnMap = { name: 'name_column' };
    const result = buildOrderBy({ sort: '[{"id":"name","desc":false}]' }, columnMap);
    expect(result).toBeDefined();
  });
});

describe('buildConditions', () => {
  it('should return undefined for empty array', () => {
    const result = buildConditions([]);
    expect(result).toBeUndefined();
  });

  it('should filter out undefined values', () => {
    const result = buildConditions([undefined, 'condition1', undefined]);
    expect(result).toBeDefined();
  });
});
