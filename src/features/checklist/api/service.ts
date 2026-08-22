import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { businessDateInTimeZone } from '@/lib/dates';
import { updateChecklistItemSchema, setGlobalNoteSchema } from './validation';
import { resolveChecklistDay, type HolidayRow } from '../utils/day';
import type { ChecklistItem, DailyChecklist, DailyChecklistResponse } from './types';
import type { DailyChecklistItem } from '@/lib/db/schema/checklists';

function serializeChecklist(row: {
  id: number;
  checklist_date: string;
  status: DailyChecklist['status'];
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  started_at: Date | null;
  ended_at: Date | null;
  global_note: string;
}): DailyChecklist {
  return {
    id: row.id,
    checklistDate: row.checklist_date,
    status: row.status,
    shiftName: row.shift_name,
    shiftStartTime: row.shift_start_time,
    shiftEndTime: row.shift_end_time,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    globalNote: row.global_note
  };
}

function serializeItems(rows: DailyChecklistItem[]): ChecklistItem[] {
  return rows.map((r) => ({
    id: r.id,
    itemKey: r.item_key,
    outcome: r.outcome,
    note: r.note,
    photoKey: r.photo_key
  }));
}

export const getMyDailyChecklistFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requirePermission('checklist', 'view');
  await checkRateLimit(`checklist:${session.user.id}`);

  const [{ getMonthlyScheduleData }, { findDailyChecklist, createDailyChecklistWithItems }] =
    await Promise.all([import('@/lib/db/attendance'), import('@/lib/db/checklists')]);

  const today = businessDateInTimeZone(new Date());
  const month = today.slice(0, 7);
  const scheduleData = await getMonthlyScheduleData(session.user.id, month);

  const resolution = resolveChecklistDay({
    date: today,
    assignment: scheduleData.assignment,
    weekdayRules: scheduleData.weekdayRules.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isWorkingDay: r.isWorkingDay,
      startTime: r.startTime,
      endTime: r.endTime,
      lateToleranceMinutes: r.lateToleranceMinutes,
      absenceCutoffMinutes: r.absenceCutoffMinutes
    })),
    overrides: scheduleData.overrides,
    dayOffs: scheduleData.dayOffs,
    holidays: scheduleData.holidays as HolidayRow[]
  });

  if (resolution.status !== 'working' || !resolution.schedule) {
    return { success: true, dayStatus: resolution.status, checklist: null, items: [] };
  }

  const existing = await findDailyChecklist(session.user.id, today);
  if (existing) {
    return {
      success: true,
      dayStatus: 'working',
      checklist: serializeChecklist(existing.checklist),
      items: serializeItems(existing.items)
    };
  }

  const created = await createDailyChecklistWithItems(session.user.id, today, {
    shiftId: resolution.schedule.shiftId,
    shiftName: scheduleData.assignment?.shiftName ?? '',
    startTime: resolution.schedule.startTime,
    endTime: resolution.schedule.endTime
  });

  return {
    success: true,
    dayStatus: 'working',
    checklist: serializeChecklist(created.checklist),
    items: serializeItems(created.items)
  };
});

export const updateChecklistItemFn = createServerFn({ method: 'POST' })
  .validator(updateChecklistItemSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('checklist', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateChecklistItem } = await import('@/lib/db/checklists');
    return updateChecklistItem(session.user.id, data.itemId, {
      outcome: data.outcome,
      note: data.note,
      photoKey: data.photoKey
    });
  });

export const setGlobalNoteFn = createServerFn({ method: 'POST' })
  .validator(setGlobalNoteSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('checklist', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { setGlobalNote } = await import('@/lib/db/checklists');
    return setGlobalNote(session.user.id, data.checklistId, data.note);
  });

export type { DailyChecklistResponse };
