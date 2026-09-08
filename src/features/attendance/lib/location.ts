// Default max GPS-fix staleness (ms). Kept in sync across the location
// form's default state and the edit prefill; the DB column default (30000)
// mirrors this value.
export const DEFAULT_MAX_STALE_MS = 30_000;
