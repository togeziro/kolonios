import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en/translation.json';
import id from '@/i18n/locales/id/translation.json';
import { navTitleKeys } from './app-sidebar';

function resolveKey(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, locale);
}

describe('sidebar navigation translations', () => {
  it('maps every tickets page title to a translation key', () => {
    for (const title of ['Tickets', 'All Tickets', 'Available Jobs', 'New Ticket']) {
      expect(navTitleKeys[title]).toBeDefined();
    }
  });

  it('maps every attendance admin page title to a translation key', () => {
    for (const title of [
      'Attendance Locations',
      'Attendance Schedules',
      'Schedule Grid',
      'Attendance Assignments',
      'Attendance Reports',
      'Attendance Face Settings'
    ]) {
      expect(navTitleKeys[title], `missing nav key for ${title}`).toBeDefined();
    }
  });

  it('resolves every nav title key in both locales', () => {
    const missing = Object.entries(navTitleKeys)
      .filter(([, key]) => !resolveKey(en, key))
      .map(([title]) => title);
    expect(missing).toEqual([]);
    for (const [, key] of Object.entries(navTitleKeys)) {
      expect(resolveKey(id, key)).toBeDefined();
    }
  });
});
