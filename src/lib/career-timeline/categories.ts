// Single source of truth for Career Event categories. DB-free and pure so
// both the domain engine and the schema layer derive from it — a new
// category is a one-line change here, and TypeScript enforces that the
// engine's visual maps cover it (Record<CareerEventCategory, ...>).

export const CAREER_EVENT_CATEGORIES = [
  'position',
  'division',
  'employment_status',
  'start_work'
] as const;

export type CareerEventCategory = (typeof CAREER_EVENT_CATEGORIES)[number];
