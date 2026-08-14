import { describe, expect, it } from 'vitest';
import { dataTableConfig } from '@/config/data-table';
import {
  getCommonPinningStyles,
  getDefaultFilterOperator,
  getFilterOperators,
  getValidFilters
} from './data-table';
import type { ExtendedColumnFilter } from '@/types/data-table';

type FakePinnedLeaf = { id: string; getSize: () => number };

function fakeColumn({
  pin = false,
  size = 100,
  id = 'name',
  pinnedLeaves = [{ id, getSize: () => size }]
}: {
  pin?: false | 'start' | 'end';
  size?: number;
  id?: string;
  pinnedLeaves?: FakePinnedLeaf[];
} = {}) {
  return {
    id,
    getIsPinned: () => pin,
    getSize: () => size,
    getLeafColumns: () => [{ id }],
    table: {
      getStartLeafColumns: () => pinnedLeaves,
      getEndLeafColumns: () => pinnedLeaves
    }
  };
}

describe('getCommonPinningStyles', () => {
  it('returns relative positioning when unpinned', () => {
    const styles = getCommonPinningStyles({ column: fakeColumn() as never });
    expect(styles.position).toBe('relative');
    expect(styles.boxShadow).toBeUndefined();
    expect(styles.width).toBe(100);
  });

  it('returns sticky start styles for the last start-pinned column', () => {
    const styles = getCommonPinningStyles({ column: fakeColumn({ pin: 'start' }) as never });
    expect(styles.position).toBe('sticky');
    expect(styles.left).toBe('0px');
    expect(styles.boxShadow).toContain('inset');
  });

  it('returns sticky end styles for the first end-pinned column', () => {
    const styles = getCommonPinningStyles({ column: fakeColumn({ pin: 'end' }) as never });
    expect(styles.position).toBe('sticky');
    expect(styles.right).toBe('0px');
    expect(styles.boxShadow).toContain('inset');
  });

  it('offsets a start-pinned column by the width of the columns before it', () => {
    const styles = getCommonPinningStyles({
      column: fakeColumn({
        pin: 'start',
        id: 'actions',
        pinnedLeaves: [
          { id: 'name', getSize: () => 120 },
          { id: 'actions', getSize: () => 80 }
        ]
      }) as never
    });
    expect(styles.left).toBe('120px');
  });

  it('offsets an end-pinned column by the width of the columns after it', () => {
    const styles = getCommonPinningStyles({
      column: fakeColumn({
        pin: 'end',
        id: 'actions',
        pinnedLeaves: [
          { id: 'actions', getSize: () => 80 },
          { id: 'status', getSize: () => 100 }
        ]
      }) as never
    });
    expect(styles.right).toBe('100px');
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
