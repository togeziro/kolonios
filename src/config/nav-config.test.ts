import { describe, expect, it } from 'vitest';
import { navGroups } from './nav-config';

describe('nav-config', () => {
  it('does not expose demo/showcase pages in production navigation', () => {
    const urls = navGroups.flatMap((group) =>
      group.items.flatMap((item) => [item.url, ...(item.items ?? []).map((sub) => sub.url)])
    );
    for (const demoPrefix of [
      '/dashboard/forms',
      '/dashboard/react-query',
      '/dashboard/elements'
    ]) {
      expect(urls.some((url) => url.startsWith(demoPrefix))).toBe(false);
    }
  });

  it('keeps the four core module groups', () => {
    const labels = navGroups.map((group) => group.label);
    expect(labels).toContain('Overview');
    expect(labels).toContain('Settings');
    expect(labels).not.toContain('Elements');
  });
});
