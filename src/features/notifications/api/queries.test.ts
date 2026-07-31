import { describe, expect, it } from 'vitest';
import { notificationListQueryOptions } from './queries';

describe('notificationListQueryOptions', () => {
  it('polls every 30 seconds while the tab is visible', () => {
    const options = notificationListQueryOptions();
    expect(options.refetchInterval).toBe(30_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
  });

  it('keeps notifications fresh for at most 15 seconds', () => {
    const options = notificationListQueryOptions();
    expect(options.staleTime).toBe(15_000);
  });
});
