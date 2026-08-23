import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_ITEMS,
  CHECKLIST_ITEM_KEYS,
  isChecklistItemKey,
  countResolvedItems,
  validateSubmission,
  type ValidatableItem
} from './engine';

function item(overrides: Partial<ValidatableItem> = {}): ValidatableItem {
  return { itemKey: 'cekOlt', outcome: 'pending', note: '', ...overrides };
}

describe('item catalog', () => {
  it('defines six equipment items', () => {
    expect(CHECKLIST_ITEM_KEYS).toEqual([
      'cekOlt',
      'cekAccu',
      'cekUispRadio',
      'cekTemp',
      'cekUps',
      'cekElectricMeter'
    ]);
    expect(CHECKLIST_ITEMS).toHaveLength(6);
    for (const def of CHECKLIST_ITEMS) {
      expect(def.icon).toBeTruthy();
    }
  });

  it('accepts known keys and rejects unknown ones', () => {
    expect(isChecklistItemKey('cekUps')).toBe(true);
    expect(isChecklistItemKey('cekNonsense')).toBe(false);
  });
});

describe('countResolvedItems', () => {
  it('counts only ok and issue outcomes', () => {
    const items = [
      item({ outcome: 'ok' }),
      item({ outcome: 'issue', note: 'x' }),
      item(),
      item({ outcome: 'ok' })
    ];
    expect(countResolvedItems(items)).toBe(3);
  });

  it('counts zero on a fresh checklist', () => {
    expect(countResolvedItems(CHECKLIST_ITEM_KEYS.map((k) => item({ itemKey: k })))).toBe(0);
  });
});

describe('validateSubmission', () => {
  it('is ready when every item is resolved with issues noted', () => {
    const items = [item({ outcome: 'ok' }), item({ outcome: 'issue', note: 'ACCUs low' })];
    expect(validateSubmission(items)).toEqual({ ready: true, problems: [] });
  });

  it('flags pending items', () => {
    const res = validateSubmission([item({ outcome: 'ok' }), item()]);
    expect(res.ready).toBe(false);
    expect(res.problems).toEqual(['pendingItems']);
  });

  it('flags an issue without a note', () => {
    const res = validateSubmission([item({ outcome: 'issue' })]);
    expect(res.ready).toBe(false);
    expect(res.problems).toEqual(['issueWithoutNote']);
  });

  it('a whitespace-only note does not satisfy an issue', () => {
    const res = validateSubmission([item({ outcome: 'issue', note: '   ' })]);
    expect(res.problems).toContain('issueWithoutNote');
  });

  it('reports both problems together', () => {
    const res = validateSubmission([item(), item({ outcome: 'issue' })]);
    expect(res.problems).toEqual(['pendingItems', 'issueWithoutNote']);
  });

  it('an empty checklist is not submittable', () => {
    expect(validateSubmission([])).toEqual({ ready: true, problems: [] });
  });
});
