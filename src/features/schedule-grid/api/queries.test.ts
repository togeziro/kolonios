import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getScheduleGridFn: vi.fn()
}));

import { scheduleGridKeys, scheduleGridQueryOptions } from './queries';
import { getScheduleGridFn } from './service';

describe('scheduleGridKeys', () => {
  it('anchors all keys under the schedule-grid namespace', () => {
    expect(scheduleGridKeys.all).toEqual(['schedule-grid']);
  });

  it('shapes the per-week key from the full filter object', () => {
    const filters = {
      month: '2026-08',
      weekStart: '2026-08-03',
      divisionId: '2',
      query: 'aldi',
      page: 1,
      pageSize: 25
    };
    expect(scheduleGridKeys.week(filters)).toEqual(['schedule-grid', 'week', filters]);
  });
});

describe('scheduleGridQueryOptions', () => {
  it('uses the per-week key and forwards filters to the server fn', async () => {
    const filters = {
      month: '2026-08',
      weekStart: '2026-08-03',
      divisionId: null,
      query: null,
      page: 1,
      pageSize: 25
    };
    const opts = scheduleGridQueryOptions(filters);
    expect(opts.queryKey).toEqual(['schedule-grid', 'week', filters]);
    await opts.queryFn!(undefined as never);
    expect(getScheduleGridFn).toHaveBeenCalledWith({ data: filters });
  });
});
