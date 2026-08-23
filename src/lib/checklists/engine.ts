// Pure Daily Checklist domain: the item catalog and submission-readiness
// rules. No DB, no IO. Both the persistence layer (enforcement on submit)
// and the UI (readiness preview) consume this module.
import type { ChecklistItemOutcome } from '@/lib/db/schema/checklists';

// --- Item catalog ---

export type ChecklistItemKey =
  | 'cekOlt'
  | 'cekAccu'
  | 'cekUispRadio'
  | 'cekTemp'
  | 'cekUps'
  | 'cekElectricMeter';

export type ChecklistItemDefinition = { key: ChecklistItemKey; icon: string };

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: 'cekOlt', icon: 'router' },
  { key: 'cekAccu', icon: 'batteryCharging' },
  { key: 'cekUispRadio', icon: 'radioTower' },
  { key: 'cekTemp', icon: 'thermometer' },
  { key: 'cekUps', icon: 'zap' },
  { key: 'cekElectricMeter', icon: 'gauge' }
];

export const CHECKLIST_ITEM_KEYS = CHECKLIST_ITEMS.map((i) => i.key);

export function isChecklistItemKey(key: string): key is ChecklistItemKey {
  return (CHECKLIST_ITEM_KEYS as string[]).includes(key);
}

// --- Submission readiness ---

export type ValidatableItem = {
  itemKey: string;
  outcome: ChecklistItemOutcome;
  note: string;
};

export type SubmissionProblem = 'pendingItems' | 'issueWithoutNote';

export function countResolvedItems(items: ValidatableItem[]): number {
  return items.filter((i) => i.outcome !== 'pending').length;
}

/**
 * Submission readiness: nothing left pending, and every reported issue
 * carries an explanatory note. Photos are recommended but never required.
 */
export function validateSubmission(items: ValidatableItem[]): {
  ready: boolean;
  problems: SubmissionProblem[];
} {
  const problems: SubmissionProblem[] = [];
  if (items.some((i) => i.outcome === 'pending')) problems.push('pendingItems');
  if (items.some((i) => i.outcome === 'issue' && !i.note.trim())) {
    problems.push('issueWithoutNote');
  }
  return { ready: problems.length === 0, problems };
}
