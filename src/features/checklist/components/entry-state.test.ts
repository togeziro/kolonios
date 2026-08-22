import { describe, expect, it } from 'vitest';
import { checklistEntryState, isChecklistViewAllowed } from './entry-state';

const allowed = { viewAllowed: true };

describe('isChecklistViewAllowed', () => {
  it('allows admins regardless of the matrix', () => {
    expect(isChecklistViewAllowed({}, true)).toBe(true);
  });

  it('requires the checklist.view matrix entry otherwise', () => {
    expect(isChecklistViewAllowed({ checklist: { view: true } }, false)).toBe(true);
    expect(isChecklistViewAllowed({}, false)).toBe(false);
  });
});

describe('checklistEntryState', () => {
  it('hides everything without view rights', () => {
    const res = checklistEntryState({ status: 'draft', viewAllowed: false, variant: 'card' });
    expect(res.visible).toBe(false);
  });

  it('card shows any existing checklist with its status', () => {
    for (const status of ['draft', 'submitted', 'approved', 'rejected']) {
      const res = checklistEntryState({ status, ...allowed, variant: 'card' });
      expect(res.visible).toBe(true);
      expect(res.statusKey).toBe(`checklist.status.${status}`);
    }
  });

  it('chip is advisory: draft and rejected only', () => {
    expect(checklistEntryState({ status: 'draft', ...allowed, variant: 'chip' }).visible).toBe(
      true
    );
    expect(checklistEntryState({ status: 'rejected', ...allowed, variant: 'chip' }).visible).toBe(
      true
    );
    expect(checklistEntryState({ status: 'submitted', ...allowed, variant: 'chip' }).visible).toBe(
      false
    );
    expect(checklistEntryState({ status: 'approved', ...allowed, variant: 'chip' }).visible).toBe(
      false
    );
  });

  it('actionable states carry the action tone', () => {
    expect(checklistEntryState({ status: 'draft', ...allowed, variant: 'chip' }).tone).toBe(
      'action'
    );
    expect(checklistEntryState({ status: 'submitted', ...allowed, variant: 'card' }).tone).toBe(
      'info'
    );
  });

  it('no checklist today means hidden', () => {
    expect(checklistEntryState({ status: null, ...allowed, variant: 'card' }).visible).toBe(false);
  });
});
