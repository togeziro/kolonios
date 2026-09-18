/**
 * Pure range-trim planning for the admin schedule grid's row-header
 * "Clear week" action.
 *
 * Given one `schedule_assignments` row and the visible 7-day window
 * (`weekStart`..`weekStart + 6`), decides what the server fn must do so the
 * week's days are excluded from the row while every day OUTSIDE the week is
 * preserved:
 *
 *   - `delete`    — the row sits fully inside the week (nothing to keep);
 *   - `trimStart` — the row's head is inside the week: move `effective_from`
 *                   to `remainingFrom`;
 *   - `trimEnd`   — the row's tail is inside the week: move `effective_to`
 *                   to `remainingTo`;
 *   - `split`     — the row spans the whole week: keep the head as
 *                   `[from, leftTo]` and insert the tail `[rightFrom, to]`.
 *
 * Invariants (the whole reason this is a separate, pure function):
 *   - it NEVER emits an inverted/empty range — every boundary is validated
 *     before it is returned, and an input range that is already inverted
 *     plans `none` (see `scheduleAssignmentRangeValid` in
 *     `src/lib/db/attendance.ts` and the prod incident note in
 *     `cell-resolver.ts`);
 *   - YYYY-MM-DD lexicographic comparison is chronological, so no date
 *     parsing is needed.
 *
 * Lives in the feature (ADR-0001) and owns no DB access; the server fn
 * composes it inside its transaction.
 */

import { addDays } from './date-utils';

export type ClearAssignmentPlan =
  | { kind: 'none' }
  | { kind: 'delete' }
  /** Keep `[remainingFrom, effectiveTo]`; set the row's `effective_from`. */
  | { kind: 'trimStart'; remainingFrom: string }
  /** Keep `[effectiveFrom, remainingTo]`; set the row's `effective_to`. */
  | { kind: 'trimEnd'; remainingTo: string }
  /** Keep `[effectiveFrom, leftTo]` in place; insert `[rightFrom, effectiveTo]`. */
  | { kind: 'split'; leftTo: string; rightFrom: string };

export function planClearAssignmentRange(args: {
  effectiveFrom: string;
  effectiveTo: string;
  weekStart: string;
  weekEnd: string;
}): ClearAssignmentPlan {
  const { effectiveFrom: from, effectiveTo: to, weekStart, weekEnd } = args;

  // Inverted input is not a real range: never touch it, never split it.
  if (from > to) return { kind: 'none' };

  // No overlap with the window (also covers rows fully before/after it).
  if (to < weekStart || from > weekEnd) return { kind: 'none' };

  // Fully inside the week — the whole row goes.
  if (from >= weekStart && to <= weekEnd) return { kind: 'delete' };

  // Contains the whole week — keep both ends, drop the middle.
  if (from < weekStart && to > weekEnd) {
    return {
      kind: 'split',
      leftTo: addDays(weekStart, -1),
      rightFrom: addDays(weekEnd, 1)
    };
  }

  // Starts before the week, ends inside it — trim the tail.
  if (from < weekStart) {
    const remainingTo = addDays(weekStart, -1);
    if (from > remainingTo) return { kind: 'none' };
    return { kind: 'trimEnd', remainingTo };
  }

  // Starts inside the week, ends after it — trim the head.
  const remainingFrom = addDays(weekEnd, 1);
  if (remainingFrom > to) return { kind: 'none' };
  return { kind: 'trimStart', remainingFrom };
}
