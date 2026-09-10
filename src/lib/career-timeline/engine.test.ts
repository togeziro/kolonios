import { describe, expect, it } from 'vitest';
import {
  CAREER_EVENT_CATEGORIES,
  categoryColor,
  categoryIcon,
  categoryLabel,
  lengthOfService,
  sortEventsByEffectiveDateDesc,
  type CareerEventCategory,
  type CareerEventRow
} from './engine';

function row(
  overrides: Partial<CareerEventRow> & Pick<CareerEventRow, 'id' | 'effective_date'>
): CareerEventRow {
  return {
    employee_id: 'emp-1',
    category: 'position',
    notes: '',
    actor_user_id: null,
    from_designation_id: null,
    to_designation_id: 1,
    from_department_id: null,
    to_department_id: null,
    from_label: null,
    to_label: 'Field Services Engineer',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides
  };
}

describe('lengthOfService', () => {
  it('returns zero tenure when the employee joined today', () => {
    expect(lengthOfService('2026-09-10', new Date(2026, 8, 10))).toEqual({
      years: 0,
      months: 0
    });
  });

  it('returns 1 month when the employee joined exactly one calendar month ago', () => {
    expect(lengthOfService('2026-08-10', new Date(2026, 8, 10))).toEqual({
      years: 0,
      months: 1
    });
  });

  it('returns 11 months for 11 months 29 days — still under a year', () => {
    // joined 2025-09-11, today 2026-09-10 → 11 complete calendar months, 1 day short of a year
    expect(lengthOfService('2025-09-11', new Date(2026, 8, 10))).toEqual({
      years: 0,
      months: 11
    });
  });

  it('returns 1 year 0 months on the exact one-year anniversary', () => {
    expect(lengthOfService('2025-09-10', new Date(2026, 8, 10))).toEqual({
      years: 1,
      months: 0
    });
  });

  it('stays at 1 year 0 months one day after the anniversary', () => {
    // joined 2025-09-09, today 2026-09-10: 1 year + 1 day; no extra calendar month
    expect(lengthOfService('2025-09-09', new Date(2026, 8, 10))).toEqual({
      years: 1,
      months: 0
    });
  });

  it('counts extra calendar months after the anniversary', () => {
    // joined 2025-07-10, today 2026-09-10 → 1 year + 2 months
    expect(lengthOfService('2025-07-10', new Date(2026, 8, 10))).toEqual({
      years: 1,
      months: 2
    });
  });

  it('is timezone-stable for the join date string (YYYY-MM-DD is calendar-based)', () => {
    // Whatever the runtime timezone, "2025-09-10" → "2026-09-10" is exactly one calendar year.
    expect(lengthOfService('2025-09-10', new Date(Date.UTC(2026, 8, 10, 23, 59, 59)))).toEqual({
      years: 1,
      months: 0
    });
  });

  it('returns null for a malformed join date', () => {
    expect(lengthOfService('not-a-date', new Date(2026, 8, 10))).toBeNull();
    expect(lengthOfService('2026-09', new Date(2026, 8, 10))).toBeNull();
  });

  it('returns null when the join date is in the future (negative tenure)', () => {
    // joined 2026-09-11, today 2026-09-10 → negative tenure
    expect(lengthOfService('2026-09-11', new Date(2026, 8, 10))).toBeNull();
  });
});

describe('categoryColor and categoryIcon', () => {
  it('exposes every category listed in the schema', () => {
    expect([...CAREER_EVENT_CATEGORIES].toSorted()).toEqual(
      ['division', 'employment_status', 'position', 'start_work'].toSorted()
    );
  });

  it('returns a defined color for every category', () => {
    for (const category of CAREER_EVENT_CATEGORIES) {
      expect(categoryColor(category)).toBeTruthy();
    }
  });

  it('returns a defined icon for every category', () => {
    for (const category of CAREER_EVENT_CATEGORIES) {
      expect(categoryIcon(category)).toBeTruthy();
    }
  });

  it('distinct categories map to distinct visual signals (color or icon)', () => {
    const colors = new Set(CAREER_EVENT_CATEGORIES.map(categoryColor));
    const icons = new Set(CAREER_EVENT_CATEGORIES.map(categoryIcon));
    expect(colors.size).toBe(CAREER_EVENT_CATEGORIES.length);
    expect(icons.size).toBe(CAREER_EVENT_CATEGORIES.length);
  });

  it('categoryColor is stable per category (pinned by tests)', () => {
    expect(categoryColor('position')).toBe(categoryColor('position'));
    expect(categoryColor('start_work')).toBe(categoryColor('start_work'));
  });

  it('categoryIcon is stable per category (pinned by tests)', () => {
    expect(categoryIcon('division')).toBe(categoryIcon('division'));
  });

  it('handles unknown categories without throwing (defensive default)', () => {
    expect(() => categoryColor('bogus' as CareerEventCategory)).not.toThrow();
    expect(() => categoryIcon('bogus' as CareerEventCategory)).not.toThrow();
  });
});

describe('categoryLabel', () => {
  it('returns the canonical category suffix for every known category', () => {
    expect(categoryLabel('position')).toBe('position');
    expect(categoryLabel('division')).toBe('division');
    expect(categoryLabel('employment_status')).toBe('employment_status');
    expect(categoryLabel('start_work')).toBe('start_work');
  });

  it('returns a defined suffix for any string (never undefined)', () => {
    expect(categoryLabel('bogus' as CareerEventCategory)).toBeTruthy();
  });

  it('exposes a suffix usable as an i18n key path component', () => {
    // The UI composes: t(`employee.careerTimeline.category.${categoryLabel(...)}`)
    // so the returned value MUST match the locale file keys verbatim.
    for (const category of CAREER_EVENT_CATEGORIES) {
      expect(categoryLabel(category)).toBe(category);
    }
  });
});

describe('sortEventsByEffectiveDateDesc', () => {
  it('orders events by effective_date descending (newest first)', () => {
    const events = [
      row({ id: 1, effective_date: '2026-01-10' }),
      row({ id: 2, effective_date: '2026-03-15' }),
      row({ id: 3, effective_date: '2026-02-20' })
    ];
    const sorted = sortEventsByEffectiveDateDesc(events);
    expect(sorted.map((e) => e.id)).toEqual([2, 3, 1]);
  });

  it('uses id DESC as the deterministic tie-breaker when effective_date is equal', () => {
    const events = [
      row({ id: 1, effective_date: '2026-03-15' }),
      row({ id: 5, effective_date: '2026-03-15' }),
      row({ id: 2, effective_date: '2026-03-15' })
    ];
    const sorted = sortEventsByEffectiveDateDesc(events);
    expect(sorted.map((e) => e.id)).toEqual([5, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const events = [
      row({ id: 1, effective_date: '2026-01-10' }),
      row({ id: 2, effective_date: '2026-03-15' })
    ];
    const beforeIds = events.map((e) => e.id);
    sortEventsByEffectiveDateDesc(events);
    expect(events.map((e) => e.id)).toEqual(beforeIds);
  });

  it('returns an empty array unchanged', () => {
    expect(sortEventsByEffectiveDateDesc([])).toEqual([]);
  });
});
