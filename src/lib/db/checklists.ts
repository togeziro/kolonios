import { and, eq } from 'drizzle-orm';
import { db } from './index';
import {
  dailyChecklistItems,
  dailyChecklists,
  type DailyChecklist,
  type DailyChecklistItem
} from './schema/checklists';
import { CHECKLIST_ITEM_KEYS } from '@/features/checklist/config/items';

export type ChecklistShiftSnapshot = {
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
};

export async function findDailyChecklist(
  userId: string,
  date: string
): Promise<{ checklist: DailyChecklist; items: DailyChecklistItem[] } | null> {
  const [checklist] = await db
    .select()
    .from(dailyChecklists)
    .where(and(eq(dailyChecklists.user_id, userId), eq(dailyChecklists.checklist_date, date)))
    .limit(1);

  if (!checklist) return null;

  const items = await db
    .select()
    .from(dailyChecklistItems)
    .where(eq(dailyChecklistItems.checklist_id, checklist.id));

  return { checklist, items };
}

export async function createDailyChecklistWithItems(
  userId: string,
  date: string,
  shift: ChecklistShiftSnapshot | null
): Promise<{ checklist: DailyChecklist; items: DailyChecklistItem[] }> {
  const [checklist] = await db
    .insert(dailyChecklists)
    .values({
      user_id: userId,
      checklist_date: date,
      shift_id: shift?.shiftId ?? null,
      shift_name: shift?.shiftName ?? '',
      shift_start_time: shift?.startTime ?? '',
      shift_end_time: shift?.endTime ?? ''
    })
    .returning();

  const items = await db
    .insert(dailyChecklistItems)
    .values(CHECKLIST_ITEM_KEYS.map((item_key) => ({ checklist_id: checklist.id, item_key })))
    .returning();

  return { checklist, items };
}
