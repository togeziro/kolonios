import { describe, expect, it } from 'vitest';
import { resolveAppLocale } from './service';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

describe('resolveAppLocale', () => {
  it('defaults to id-ID when no company settings row exists', () => {
    expect(resolveAppLocale(null)).toBe('id-ID');
  });

  it('returns the stored locale when valid', () => {
    expect(resolveAppLocale({ locale: 'en-US' } as unknown as CompanySetting)).toBe('en-US');
  });

  it('falls back to id-ID for an invalid stored value', () => {
    expect(resolveAppLocale({ locale: 'de-DE' } as unknown as CompanySetting)).toBe('id-ID');
  });
});
