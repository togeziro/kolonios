// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { totalMaterialQty } from './ticket-completed-page';

describe('totalMaterialQty', () => {
  it('sums quantities across materials', () => {
    expect(
      totalMaterialQty([
        {
          id: 1,
          legId: 1,
          legName: 'A',
          materialName: 'X',
          qty: 2,
          unit: '',
          source: 'van',
          barcode: ''
        },
        {
          id: 2,
          legId: 2,
          legName: 'B',
          materialName: 'Y',
          qty: 3,
          unit: '',
          source: 'van',
          barcode: ''
        }
      ])
    ).toBe(5);
  });

  it('returns 0 for an empty list', () => {
    expect(totalMaterialQty([])).toBe(0);
  });
});
