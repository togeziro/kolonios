import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from './index';
import {
  dailyChecklistItems,
  dailyChecklists,
  type ChecklistItemOutcome,
  type DailyChecklist,
  type DailyChecklistItem
} from './schema/checklists';
import { roleGroups } from './schema/role-groups';
import { userRoleGroups } from './schema/user-role-groups';
import { user } from './auth-schema';
import { employeeShifts } from './schema/attendance';
import { CHECKLIST_ITEM_KEYS, validateSubmission } from '@/lib/checklists/engine';
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

export async function submitDailyChecklist(userId: string, checklistId: number) {
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

    const items = await db
      .select()
      .from(dailyChecklistItems)
      .where(eq(dailyChecklistItems.checklist_id, checklistId));

    const validation = validateSubmission(
      items.map((i) => ({ itemKey: i.item_key, outcome: i.outcome, note: i.note }))
    );
    if (!validation.ready) {
      return { success: false as const, problems: validation.problems };
    }

    const [updated] = await db
      .update(dailyChecklists)
      .set({
        status: 'submitted',
        ended_at: new Date(),
        reviewer_id: null,
        review_note: '',
        reviewed_at: null,
        updated_at: new Date()
      })
      .where(eq(dailyChecklists.id, checklistId))
      .returning();

    return { success: true as const, checklist: updated };
  } catch (e) {
    mapDbError(e, 'checklists.submitDailyChecklist');
  }
}

export async function reopenDailyChecklist(
  actorId: string,
  checklistId: number,
  options: { asReviewer: boolean }
) {
  try {
    const condition = options.asReviewer
      ? eq(dailyChecklists.id, checklistId)
      : and(eq(dailyChecklists.id, checklistId), eq(dailyChecklists.user_id, actorId));

    const [checklist] = await db.select().from(dailyChecklists).where(condition).limit(1);

    if (!checklist) return { success: false as const, message: 'Checklist not found' };
    if (checklist.status !== 'rejected') {
      return { success: false as const, message: 'Only rejected checklists can be reopened' };
    }

    const [updated] = await db
      .update(dailyChecklists)
      .set({ status: 'draft', ended_at: null, updated_at: new Date() })
      .where(eq(dailyChecklists.id, checklistId))
      .returning();

    return { success: true as const, checklist: updated };
  } catch (e) {
    mapDbError(e, 'checklists.reopenDailyChecklist');
  }
}

export async function listChecklistReviewerIds(): Promise<string[]> {
  try {
    const rows = await db
      .select({ userId: userRoleGroups.user_id })
      .from(userRoleGroups)
      .innerJoin(roleGroups, eq(userRoleGroups.role_group_id, roleGroups.id))
      .where(
        or(
          eq(roleGroups.is_admin, true),
          sql`(${roleGroups.permissions} -> 'checklist' ->> 'approve')::boolean is true`
        )
      );
    return [...new Set(rows.map((r) => r.userId))];
  } catch (e) {
    mapDbError(e, 'checklists.listChecklistReviewerIds');
  }
}

export type ReviewSubmissionRow = DailyChecklist & {
  technicianName: string;
  itemsTotal: number;
  itemsResolved: number;
  photos: { id: number; key: string }[];
  reviewerName: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
};

export function serializeReviewSubmissionRow(r: ReviewSubmissionRow) {
  const statusMap: Record<DailyChecklist['status'], 'pending' | 'approved' | 'rejected'> = {
    draft: 'pending',
    submitted: 'pending',
    approved: 'approved',
    rejected: 'rejected'
  };
  return {
    id: r.id,
    checklistId: r.id,
    technicianId: r.user_id,
    technicianName: r.technicianName,
    checklistDate: r.checklist_date,
    scheduleWindow: `${r.checklist_date} · ${r.shift_start_time || ''}${r.shift_start_time && r.shift_end_time ? ' - ' : ''}${r.shift_end_time || r.shift_name}`,
    clockInAt: r.clockInAt ?? null,
    clockOutAt: r.clockOutAt ?? null,
    itemsResolved: r.itemsResolved,
    itemsTotal: r.itemsTotal,
    tasksLogged: 0,
    note: r.global_note,
    photos: r.photos,
    status: statusMap[r.status] ?? 'pending',
    rejectionReason: r.rejected_reason || undefined,
    decidedBy: r.reviewerName ?? null,
    decidedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null
  };
}

export async function listMyReviewSubmissions(userId: string): Promise<ReviewSubmissionRow[]> {
  try {
    const reviewerIds = await listChecklistReviewerIds();
    if (!reviewerIds.includes(userId)) return [];

    const submitted = await db
      .select({
        checklist: dailyChecklists,
        technicianName: user.name
      })
      .from(dailyChecklists)
      .innerJoin(user, eq(dailyChecklists.user_id, user.id))
      .where(eq(dailyChecklists.status, 'submitted'))
      .orderBy(desc(dailyChecklists.checklist_date), desc(dailyChecklists.id));

    if (submitted.length === 0) return [];

    const checklistIds = submitted.map((r) => r.checklist.id);

    const allItems = await db
      .select()
      .from(dailyChecklistItems)
      .where(inArray(dailyChecklistItems.checklist_id, checklistIds));

    const itemsByChecklist = new Map<number, DailyChecklistItem[]>();
    for (const item of allItems) {
      const arr = itemsByChecklist.get(item.checklist_id) ?? [];
      arr.push(item);
      itemsByChecklist.set(item.checklist_id, arr);
    }

    const reviewerIdsSet = new Set<string>();
    for (const r of submitted) {
      if (r.checklist.reviewer_id) reviewerIdsSet.add(r.checklist.reviewer_id);
    }
    let reviewerNameMap = new Map<string, string>();
    if (reviewerIdsSet.size > 0) {
      const reviewers = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, [...reviewerIdsSet]));
      reviewerNameMap = new Map(reviewers.map((u) => [u.id, u.name]));
    }

    // Clock times are stored as text HH:MM on employee_shifts; fetch scoped by (user, date)
    const shiftRows = await db
      .select({
        userId: employeeShifts.user_id,
        date: employeeShifts.date,
        checkIn: employeeShifts.check_in_time,
        checkOut: employeeShifts.check_out_time
      })
      .from(employeeShifts)
      .where(
        and(
          inArray(
            employeeShifts.user_id,
            submitted.map((r) => r.checklist.user_id)
          ),
          inArray(employeeShifts.date, [
            ...new Set(submitted.map((r) => r.checklist.checklist_date))
          ])
        )
      );

    const shiftMap = new Map<string, { checkIn: string | null; checkOut: string | null }>();
    for (const s of shiftRows) {
      shiftMap.set(`${s.userId}|${s.date}`, {
        checkIn: s.checkIn ?? null,
        checkOut: s.checkOut ?? null
      });
    }

    return submitted.map(({ checklist, technicianName }) => {
      const items = itemsByChecklist.get(checklist.id) ?? [];
      const photos = items.filter((i) => i.photo_key).map((i) => ({ id: i.id, key: i.photo_key }));
      const shiftKey = shiftMap.get(`${checklist.user_id}|${checklist.checklist_date}`);
      return {
        ...checklist,
        technicianName,
        itemsTotal: items.length,
        itemsResolved: items.filter((i) => i.outcome !== 'pending').length,
        photos,
        reviewerName: checklist.reviewer_id
          ? (reviewerNameMap.get(checklist.reviewer_id) ?? null)
          : null,
        clockInAt: shiftKey?.checkIn ?? null,
        clockOutAt: shiftKey?.checkOut ?? null
      } as ReviewSubmissionRow;
    });
  } catch (e) {
    mapDbError(e, 'checklists.listMyReviewSubmissions');
  }
}

export async function updateChecklistStatus(
  id: number,
  status: 'approved' | 'rejected',
  options: { rejectedReason?: string; reviewerId?: string } = {}
) {
  try {
    const [checklist] = await db
      .select()
      .from(dailyChecklists)
      .where(eq(dailyChecklists.id, id))
      .limit(1);

    if (!checklist) return { success: false as const, message: 'Checklist not found' };
    if (checklist.status !== 'submitted') {
      return { success: false as const, message: 'Only submitted checklists can be reviewed' };
    }
    if (status !== 'approved' && status !== 'rejected') {
      return { success: false as const, message: 'Invalid status' };
    }

    const rejectedReason = status === 'rejected' ? (options.rejectedReason ?? '') : '';

    const [updated] = await db
      .update(dailyChecklists)
      .set({
        status,
        rejected_reason: rejectedReason,
        reviewer_id: options.reviewerId ?? checklist.reviewer_id,
        reviewed_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(dailyChecklists.id, id))
      .returning();

    return { success: true as const, checklist: updated };
  } catch (e) {
    mapDbError(e, 'checklists.updateChecklistStatus');
  }
}
