export type ValidatableItem = {
  itemKey: string;
  outcome: 'ok' | 'issue' | 'pending';
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
