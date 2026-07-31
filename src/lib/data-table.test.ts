import { describe, expect, it } from 'vitest';
import { dataTableConfig } from '@/config/data-table';
import {
  getCommonPinningStyles,
  getDefaultFilterOperator,
  getFilterOperators,
  getValidFilters
} from './data-table';
import type { ExtendedColumnFilter } from '@/types/data-table';

function fakeColumn(pin: string | false, size = 100) {
  return {
    getIsPinned: () => pin,
    getIsLastColumn: () => true,
    getIsFirstColumn: () => false,
    getStart: () => 0,
    getAfter: () => 0,
    getSize: () => size
  };
}

describe('getCommonPinningStyles', () => {
  it('returns relative positioning when unpinned', () => {
    const styles = getCommonPinningStyles({ column: fakeColumn(false) as never });
    expect(styles.position).toBe('relative');
    expect(styles.boxShadow).toBeUndefined();
    expect(styles.width).toBe(100);
  });

  it('returns sticky left styles for the last left-pinned column', () => {
    const styles = getCommonPinningStyles({ column: fakeColumn('left') as never });
    expect(styles.position).toBe('sticky');
    expect(styles.left).toBe('0px');
    expect(styles.boxShadow).toContain('inset');
  });

  it('returns sticky right styles for the first right-pinned column', () => {
    const column = {
      ...fakeColumn('right'),
      getIsFirstColumn: () => true,
      getIsLastColumn: () => false
    };
    const styles = getCommonPinningStyles({ column: column as never });
    expect(styles.position).toBe('sticky');
    expect(styles.right).toBe('0px');
  });
});

describe('getFilterOperators', () => {
  it('returns the operator list for a variant', () => {
    expect(getFilterOperators('text')).toEqual(dataTableConfig.textOperators);
    expect(getFilterOperators('number')).toEqual(dataTableConfig.numericOperators);
    expect(getFilterOperators('select')).toEqual(dataTableConfig.selectOperators);
  });

  it('falls back to text operators for unknown variants', () => {
    expect(getFilterOperators('unknown' as never)).toEqual(dataTableConfig.textOperators);
  });
});

describe('getDefaultFilterOperator', () => {
  it('returns the first operator of the variant', () => {
    expect(getDefaultFilterOperator('text')).toBe(dataTableConfig.textOperators[0]?.value);
  });

  it('falls back to iLike for text', () => {
    expect(getDefaultFilterOperator('nope' as never)).toBe('iLike');
  });
});

describe('getValidFilters', () => {
  const base = { id: 'x', variant: 'text', filterId: '1' };

  it('keeps isEmpty and isNotEmpty operators', () => {
    const filters = [
      { ...base, operator: 'isEmpty', value: null },
      { ...base, operator: 'isNotEmpty', value: 'a' }
    ] as ExtendedColumnFilter<unknown>[];
    expect(getValidFilters(filters)).toHaveLength(2);
  });

  it('drops empty values', () => {
    const filters = [
      { ...base, operator: 'eq', value: '' },
      { ...base, operator: 'eq', value: null },
      { ...base, operator: 'eq', value: undefined },
      { ...base, operator: 'eq', value: [] },
      { ...base, operator: 'eq', value: 'ok' }
    ] as ExtendedColumnFilter<unknown>[];
    const valid = getValidFilters(filters);
    expect(valid).toHaveLength(1);
    expect(valid[0].value).toBe('ok');
  });
});
