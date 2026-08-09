import { beforeEach, describe, expect, it } from 'vitest';
import { getAppLocale, setAppLocale } from './state';
import { DEFAULT_LOCALE, isAppLocale } from './types';

describe('app locale state', () => {
  beforeEach(() => setAppLocale(DEFAULT_LOCALE));

  it('defaults to id-ID', () => {
    expect(getAppLocale()).toBe('id-ID');
  });

  it('round-trips setAppLocale', () => {
    setAppLocale('en-US');
    expect(getAppLocale()).toBe('en-US');
  });

  it('guards isAppLocale', () => {
    expect(isAppLocale('id-ID')).toBe(true);
    expect(isAppLocale('de-DE')).toBe(false);
  });
});
