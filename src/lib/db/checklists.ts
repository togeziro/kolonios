import { and, eq } from 'drizzle-orm';
import { db } from './index';
import {
  dailyChecklistItems,
  dailyChecklists,
  type ChecklistItemOutcome,
  type DailyChecklist,
  type DailyChecklistItem
} from './schema/checklists';
import { CHECKLIST_ITEM_KEYS } from '@/features/checklist/config/items';
import { mapDbError } from '../errors';

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

async function loadOwnedDraftItem(userId: string, itemId: number) {
  const [row] = await db
    .select({ item: dailyChecklistItems, checklist: dailyChecklists })
    .from(dailyChecklistItems)
    .innerJoin(dailyChecklists, eq(dailyChecklistItems.checklist_id, dailyChecklists.id))
    .where(and(eq(dailyChecklistItems.id, itemId), eq(dailyChecklists.user_id, userId)))
    .limit(1);

  if (!row) return { error: 'not_found' as const };
  if (row.checklist.status !== 'draft') return { error: 'locked' as const };
  return { row };
}

export async function updateChecklistItem(
  userId: string,
  itemId: number,
  input: { outcome?: ChecklistItemOutcome; note?: string; photoKey?: string }
) {
  try {
    const owned = await loadOwnedDraftItem(userId, itemId);
    if ('error' in owned) {
      return {
        success: false as const,
        message: owned.error === 'locked' ? 'Checklist is not editable' : 'Checklist item not found'
      };
    }

    const [item] = await db
      .update(dailyChecklistItems)
      .set({
        ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.photoKey !== undefined ? { photo_key: input.photoKey } : {}),
        updated_at: new Date()
      })
      .where(eq(dailyChecklistItems.id, itemId))
      .returning();

    if (!owned.row.checklist.started_at) {
      await db
        .update(dailyChecklists)
        .set({ started_at: new Date(), updated_at: new Date() })
        .where(eq(dailyChecklists.id, owned.row.checklist.id));
    }

    return { success: true as const, item };
  } catch (e) {
    mapDbError(e, 'checklists.updateChecklistItem');
  }
}

export async function setGlobalNote(userId: string, checklistId: number, note: string) {
  try {
    const [checklist] = await db
      .select()
      .from(dailyChecklists)
      .where(and(eq(dailyChecklists.id, checklistId), eq(dailyChecklists.user_id, userId)))
      .limit(1);

    if (!checklist) return { success: false as const, message: 'Checklist not found' };
    if (checklist.status !== 'draft') {
      return { success: false as const, message: 'Checklist is not editable' };
    }

    await db
      .update(dailyChecklists)
      .set({ global_note: note, updated_at: new Date() })
      .where(eq(dailyChecklists.id, checklistId));

    return { success: true as const };
  } catch (e) {
    mapDbError(e, 'checklists.setGlobalNote');
  }
}
