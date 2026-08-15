import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getMyScheduleFn: vi.fn()
}));

import { scheduleKeys, myScheduleQueryOptions } from './queries';
import { getMyScheduleFn } from './service';

describe('scheduleKeys', () => {
  it('shapes query keys', () => {
    expect(scheduleKeys.all).toEqual(['schedule']);
    expect(scheduleKeys.month('2026-08')).toEqual(['schedule', 'month', '2026-08']);
  });
});

describe('myScheduleQueryOptions', () => {
  it('calls getMyScheduleFn with the month', async () => {
    const opts = myScheduleQueryOptions('2026-08');
    expect(opts.queryKey).toEqual(['schedule', 'month', '2026-08']);
    await opts.queryFn!(undefined as never);
    expect(getMyScheduleFn).toHaveBeenCalledWith({ data: { month: '2026-08' } });
  });
});
