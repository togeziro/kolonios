// Pure Career Timeline domain: length-of-service math, event display
// strings, category visuals, and timeline ordering. No DB, no IO, no clock.
// Every function here is deterministic given its inputs and unit-testable
// without fixtures; the persistence layer (`@/lib/db/career-timeline`)
// feeds these functions the rows they need.

// --- Category ---

export const CAREER_EVENT_CATEGORIES = [
  'position',
  'division',
  'employment_status',
  'start_work'
] as const;

export type CareerEventCategory = (typeof CAREER_EVENT_CATEGORIES)[number];

// --- Row shape (structural subset of the drizzle table) ---

export type CareerEventRow = {
  id: number;
  employee_id: string;
  category: CareerEventCategory;
  effective_date: string; // YYYY-MM-DD, sortable lexically
  notes: string | null;
  actor_user_id: string | null;
  from_designation_id: number | null;
  to_designation_id: number | null;
  from_department_id: number | null;
  to_department_id: number | null;
  from_label: string | null;
  to_label: string;
  created_at: Date;
  updated_at: Date;
};

// --- Length of service ---

/**
 * Calendar-component diff between the join date and `now`. Calendar-based
 * (not total-days / 30) so the answer is timezone-stable and matches what
 * HR expects to see in the UI. Pinned by tests:
 *
 *   joined today               → "0 Month"
 *   joined exactly 1 month ago → "1 Month"
 *   joined 11 months 29d ago   → "11 Month"
 *   joined exactly 1 year ago  → "1 Year 0 Month"
 *   joined 1y 1d ago           → "1 Year 0 Month"
 *   joined 1y 2m ago           → "1 Year 2 Month"
 */
export function lengthOfService(joinDate: string, now: Date): string {
  const parts = joinDate.split('-').map(Number);
  const jy = parts[0];
  const jm = parts[1];
  const jd = parts[2];
  if (
    jy === undefined ||
    jm === undefined ||
    jd === undefined ||
    Number.isNaN(jy) ||
    Number.isNaN(jm) ||
    Number.isNaN(jd)
  ) {
    return '0 Month';
  }

  let years = now.getFullYear() - jy;
  let months = now.getMonth() + 1 - jm;

  if (now.getDate() < jd) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (months < 0) {
    // Defensive: `now` precedes `joinDate` (negative tenure). Treat as zero.
    years = 0;
    months = 0;
  }

  if (years >= 1) {
    return `${years} Year ${months} Month`;
  }
  return `${months} Month`;
}

// --- Display strings ---

/**
 * "Not Set → X" when there is no previous label, "X → Y" otherwise.
 * The label snapshot survives masterdata renames (ADR-0007), so this
 * output is stable even if the source designation/department is renamed.
 */
export function formatEventDescription(event: {
  from_label: string | null;
  to_label: string;
}): string {
  const from = event.from_label ?? 'Not Set';
  return `${from} → ${event.to_label}`;
}

// --- Category visuals (pure strings, UI maps them to classes/icons) ---

const CATEGORY_COLOR: Record<CareerEventCategory, string> = {
  position: 'green',
  division: 'purple',
  employment_status: 'yellow',
  start_work: 'indigo'
};

const CATEGORY_ICON: Record<CareerEventCategory, string> = {
  position: 'briefcase',
  division: 'building',
  employment_status: 'user-check',
  start_work: 'play-circle'
};

const FALLBACK_COLOR = 'gray';
const FALLBACK_ICON = 'circle';
const FALLBACK_LABEL: CareerEventCategory = 'position';

export function categoryColor(category: string): string {
  return (CATEGORY_COLOR as Record<string, string>)[category] ?? FALLBACK_COLOR;
}

export function categoryIcon(category: string): string {
  return (CATEGORY_ICON as Record<string, string>)[category] ?? FALLBACK_ICON;
}

/**
 * Returns the canonical category label suffix for a career event
 * category — the i18n key fragment the UI composes into
 * `employee.careerTimeline.category.${categoryLabel(...)}`.
 *
 * Validates that the input is one of the known `CAREER_EVENT_CATEGORIES`;
 * unknown values fall back to `'position'` so the UI never renders an
 * untranslated bucket. Pure, deterministic, side-effect-free.
 */
export function categoryLabel(category: string): CareerEventCategory {
  return (CAREER_EVENT_CATEGORIES as readonly string[]).includes(category)
    ? (category as CareerEventCategory)
    : FALLBACK_LABEL;
}

// --- Sorting ---

/**
 * Newest first. Secondary sort is `id DESC` so events that share an
 * effective date (typical for seed-backfilled `start_work` events) have
 * a deterministic order — without it, the UI would flicker across
 * re-renders because the DB doesn't promise insertion order.
 *
 * Returns a new array; the input is not mutated (pinned by tests).
 */
export function sortEventsByEffectiveDateDesc<
  T extends Pick<CareerEventRow, 'id' | 'effective_date'>
>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    if (a.effective_date !== b.effective_date) {
      return a.effective_date < b.effective_date ? 1 : -1;
    }
    return b.id - a.id;
  });
}
