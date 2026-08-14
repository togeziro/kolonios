import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getMyAchievementsFn: vi.fn()
}));

import { achievementKeys, myAchievementsQueryOptions } from './queries';
import { getMyAchievementsFn } from './service';

describe('achievementKeys', () => {
  it('shapes query keys', () => {
    expect(achievementKeys.all).toEqual(['achievements']);
    expect(achievementKeys.my()).toEqual(['achievements', 'my']);
  });
});

describe('myAchievementsQueryOptions', () => {
  it('calls getMyAchievementsFn', async () => {
    const opts = myAchievementsQueryOptions();
    expect(opts.queryKey).toEqual(['achievements', 'my']);
    await opts.queryFn!({} as never);
    expect(getMyAchievementsFn).toHaveBeenCalled();
  });
});
