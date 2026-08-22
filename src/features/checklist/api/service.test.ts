import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  checkRateLimit: vi.fn(),
  businessDateInTimeZone: vi.fn(),
  getMonthlyScheduleData: vi.fn(),
  findDailyChecklist: vi.fn(),
  createDailyChecklistWithItems: vi.fn()
}));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@/lib/auth/session', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/dates', () => ({
  businessDateInTimeZone: mocks.businessDateInTimeZone
}));
vi.mock('@/lib/db/attendance', () => ({
  getMonthlyScheduleData: mocks.getMonthlyScheduleData
}));
vi.mock('@/lib/db/checklists', () => ({
  findDailyChecklist: mocks.findDailyChecklist,
  createDailyChecklistWithItems: mocks.createDailyChecklistWithItems
}));
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  }
}));
vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));
vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { getMyDailyChecklistFn_createServerFn_handler } from './service?tss-serverfn-split';

serverFnProvider.handler = getMyDailyChecklistFn_createServerFn_handler;

import { getMyDailyChecklistFn } from './service';

const WORKING_SCHEDULE = {
  assignment: { shiftId: 1, effectiveFrom: '2026-01-01', effectiveTo: null, shiftName: 'Morning Shift' },
  weekdayRules: [
    {
      dayOfWeek: 3,
      isWorkingDay: true,
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 10,
      absenceCutoffMinutes: 120
    }
  ],
  overrides: [],
  dayOffs: [],
  holidays: []
};

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: 'u1',
    checklist_date: '2026-08-12',
    shift_id: 1,
    shift_name: 'Morning Shift',
    shift_start_time: '08:00',
    shift_end_time: '17:00',
    status: 'draft',
    started_at: null,
    ended_at: null,
    global_note: '',
    reviewer_id: null,
    review_note: '',
    reviewed_at: null,
    ...overrides
  };
}

describe('getMyDailyChecklistFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.businessDateInTimeZone.mockReturnValue('2026-08-12');
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.getMonthlyScheduleData.mockResolvedValue(WORKING_SCHEDULE);
  });

  it('guards with checklist.view permission and a checklist rate limit', async () => {
    mocks.findDailyChecklist.mockResolvedValue({
      checklist: dbRow(),
      items: []
    });
    await getMyDailyChecklistFn({} as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('checklist', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('checklist:u1');
  });

  it('returns the existing checklist untouched on a second open', async () => {
    mocks.findDailyChecklist.mockResolvedValue({
      checklist: dbRow({ status: 'submitted' }),
      items: [{ id: 5, checklist_id: 1, item_key: 'cekOlt', outcome: 'ok', note: '', photo_key: '' }]
    });
    const res = await getMyDailyChecklistFn({} as never);
    expect(mocks.createDailyChecklistWithItems).not.toHaveBeenCalled();
    expect(res).toEqual({
      success: true,
      dayStatus: 'working',
      checklist: expect.objectContaining({ id: 1, status: 'submitted' }),
      items: [expect.objectContaining({ itemKey: 'cekOlt', outcome: 'ok' })]
    });
  });

  it('lazily creates today’s checklist with the shift snapshot on first open', async () => {
    mocks.findDailyChecklist.mockResolvedValue(null);
    mocks.createDailyChecklistWithItems.mockResolvedValue({
      checklist: dbRow(),
      items: [
        { id: 1, checklist_id: 1, item_key: 'cekOlt', outcome: 'pending', note: '', photo_key: '' }
      ]
    });
    const res = await getMyDailyChecklistFn({} as never);
    expect(mocks.createDailyChecklistWithItems).toHaveBeenCalledWith(
      'u1',
      '2026-08-12',
      { shiftId: 1, shiftName: 'Morning Shift', startTime: '08:00', endTime: '17:00' }
    );
    expect(res.checklist).toEqual(expect.objectContaining({ checklistDate: '2026-08-12' }));
    expect(res.items).toHaveLength(1);
  });

  it('creates nothing on a day off', async () => {
    mocks.getMonthlyScheduleData.mockResolvedValue({ ...WORKING_SCHEDULE, dayOffs: ['2026-08-12'] });
    const res = await getMyDailyChecklistFn({} as never);
    expect(res).toEqual({ success: true, dayStatus: 'day_off', checklist: null, items: [] });
    expect(mocks.findDailyChecklist).not.toHaveBeenCalled();
    expect(mocks.createDailyChecklistWithItems).not.toHaveBeenCalled();
  });

  it('creates nothing on a recurring holiday falling this year', async () => {
    mocks.getMonthlyScheduleData.mockResolvedValue({
      ...WORKING_SCHEDULE,
      holidays: [{ date: '2025-08-12', name: 'Recurring', isRecurring: true }]
    });
    const res = await getMyDailyChecklistFn({} as never);
    expect(res.dayStatus).toBe('holiday');
    expect(mocks.createDailyChecklistWithItems).not.toHaveBeenCalled();
  });

  it('creates nothing without a schedule assignment', async () => {
    mocks.getMonthlyScheduleData.mockResolvedValue({ ...WORKING_SCHEDULE, assignment: null });
    const res = await getMyDailyChecklistFn({} as never);
    expect(res.dayStatus).toBe('no_schedule');
    expect(mocks.createDailyChecklistWithItems).not.toHaveBeenCalled();
  });
});
