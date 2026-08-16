import { describe, expect, it } from 'vitest';
import { resolveLenient } from './service';

describe('resolveLenient', () => {
  it('returns false when settings is null', () => {
    expect(resolveLenient(null)).toBe(false);
  });

  it('returns false when settings is undefined', () => {
    expect(resolveLenient(undefined)).toBe(false);
  });

  it('returns false when settings.worklog_location_lenient is null', () => {
    expect(resolveLenient({ worklog_location_lenient: null })).toBe(false);
  });

  it('returns false when settings.worklog_location_lenient is false', () => {
    expect(resolveLenient({ worklog_location_lenient: false })).toBe(false);
  });

  it('returns true when settings.worklog_location_lenient is true', () => {
    expect(resolveLenient({ worklog_location_lenient: true })).toBe(true);
  });
});
