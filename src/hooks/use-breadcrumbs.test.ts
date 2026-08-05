import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en/translation.json';
import id from '@/i18n/locales/id/translation.json';
import { breadcrumbSegmentKeys } from './use-breadcrumbs';

function resolveKey(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, locale);
}

describe('breadcrumb segment keys', () => {
  it('covers every payroll admin route segment', () => {
    const payrollSegments = ['payroll', 'records', 'generate', 'periods', 'reports', 'settings'];
    for (const segment of payrollSegments) {
      expect(breadcrumbSegmentKeys[segment], `missing key for /${segment}`).toBeDefined();
    }
  });

  it('resolves every mapped segment key in both locales', () => {
    const missing = Object.entries(breadcrumbSegmentKeys).filter(
      ([segment, key]) => !resolveKey(en, key) || !resolveKey(id, key)
    );
    expect(missing).toEqual([]);
  });
});
